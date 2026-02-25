-- STEP 1: DATABASE DESIGN
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- TABLE: match_queue
CREATE TABLE IF NOT EXISTS public.match_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    game_type TEXT NOT NULL,
    stake_amount NUMERIC NOT NULL,
    rating INTEGER DEFAULT 1000,
    status TEXT DEFAULT 'searching', -- searching / matched / cancelled
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for match_queue
CREATE INDEX IF NOT EXISTS idx_match_queue_search ON public.match_queue (game_type, stake_amount, status);
CREATE INDEX IF NOT EXISTS idx_match_queue_created_at ON public.match_queue (created_at);

-- TABLE: matches
CREATE TABLE IF NOT EXISTS public.matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player1_id UUID REFERENCES auth.users(id) NOT NULL,
    player2_id UUID REFERENCES auth.users(id) NOT NULL,
    game_type TEXT NOT NULL,
    stake_amount NUMERIC NOT NULL,

    player1_time_remaining INTEGER DEFAULT 600, -- 10 minutes (600 seconds)
    player2_time_remaining INTEGER DEFAULT 600,

    player1_score INTEGER DEFAULT 0,
    player2_score INTEGER DEFAULT 0,

    last_move_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    current_turn UUID, -- User ID whose turn it is (or both for simultaneous)

    status TEXT DEFAULT 'active', -- active / reconnecting / finished / forfeited
    winner_id UUID REFERENCES auth.users(id),
    disconnect_deadline TIMESTAMP WITH TIME ZONE,

    current_apple_pos JSONB DEFAULT '{"x": 15, "y": 10}'::jsonb, -- New field for server-side apple tracking
    board_state JSONB, -- Generic field for Chess board or Checkers board

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for matches
CREATE INDEX IF NOT EXISTS idx_matches_status ON public.matches (status);
CREATE INDEX IF NOT EXISTS idx_matches_players ON public.matches (player1_id, player2_id);

-- TABLE: match_events
CREATE TABLE IF NOT EXISTS public.match_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID REFERENCES public.matches(id) NOT NULL,
    player_id UUID REFERENCES auth.users(id) NOT NULL,
    event_type TEXT NOT NULL, -- move / apple_eaten / death / reconnect / timeout
    payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS POLICIES
ALTER TABLE public.match_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_events ENABLE ROW LEVEL SECURITY;

-- Match Queue: Users can only see their own queue entries
DROP POLICY IF EXISTS "Users can view their own queue entries" ON public.match_queue;
CREATE POLICY "Users can view their own queue entries" ON public.match_queue
    FOR SELECT USING (auth.uid() = user_id);

-- Matches: Players can view matches they are part of
DROP POLICY IF EXISTS "Players can view their own matches" ON public.matches;
CREATE POLICY "Players can view their own matches" ON public.matches
    FOR SELECT USING (auth.uid() = player1_id OR auth.uid() = player2_id);

-- Match Events: Players can view events for matches they are part of
DROP POLICY IF EXISTS "Players can view events for their matches" ON public.match_events;
CREATE POLICY "Players can view events for their matches" ON public.match_events
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.matches 
            WHERE matches.id = match_events.match_id 
            AND (matches.player1_id = auth.uid() OR matches.player2_id = auth.uid())
        )
    );

-- Enable Realtime
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'matches') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'match_events') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.match_events;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'match_queue') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.match_queue;
  END IF;
END;
$$;

-- Ensure all existing users have wallets
INSERT INTO public.wallets (user_id)
SELECT id FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- Enforce REPLICA IDENTITY FULL for Realtime consistency
ALTER TABLE public.matches REPLICA IDENTITY FULL;
ALTER TABLE public.match_queue REPLICA IDENTITY FULL;

-- STEP 2: MATCHMAKING FUNCTION (POSTGRESQL)

CREATE OR REPLACE FUNCTION public.find_opponent(
    p_user_id UUID,
    p_game_type TEXT,
    p_stake_amount NUMERIC
) RETURNS JSONB AS $find_opponent_tag$
DECLARE
    v_old_entry RECORD;
    v_opponent_record RECORD;
    v_match_id UUID;
BEGIN
    -- 1. RECONNECTION CHECK (STRICT)
    -- Only reconnect if the match is FRESH (last 60s) OR has active gameplay
    -- AND the stake amount must match exactly!
    SELECT id INTO v_match_id FROM public.matches 
    WHERE status = 'active' 
      AND (player1_id = p_user_id OR player2_id = p_user_id)
      AND game_type = p_game_type
      AND stake_amount = p_stake_amount
      AND (
        created_at > (NOW() - INTERVAL '60 seconds') OR 
        player1_score > 0 OR 
        player2_score > 0 OR 
        board_state IS NOT NULL
      )
    LIMIT 1;

    IF v_match_id IS NOT NULL THEN
        RETURN jsonb_build_object('status', 'matched', 'match_id', v_match_id, 'reconnected', true);
    END IF;

    -- 2. QUEUE CHECK
    -- If already in queue for this exact setup, stay there
    IF EXISTS (
        SELECT 1 FROM public.match_queue 
        WHERE user_id = p_user_id 
          AND game_type = p_game_type 
          AND stake_amount = p_stake_amount 
          AND status = 'searching'
    ) THEN
        RETURN jsonb_build_object('status', 'searching', 'info', 'already_in_queue');
    END IF;

    -- 3. CLEANUP & REFUND OLD SEARCHES
    FOR v_old_entry IN 
        SELECT stake_amount FROM public.match_queue 
        WHERE user_id = p_user_id AND status = 'searching'
    LOOP
        PERFORM public.unlock_stake(p_user_id, v_old_entry.stake_amount);
    END LOOP;
    DELETE FROM public.match_queue WHERE user_id = p_user_id;

    -- 4. VALIDATE & LOCK STAKE
    IF p_stake_amount NOT IN (10, 50, 100, 500) THEN
        RETURN jsonb_build_object('error', 'Invalid stake amount.');
    END IF;

    IF NOT public.lock_stake(p_user_id, p_stake_amount) THEN
        RETURN jsonb_build_object('error', 'Insufficient balance');
    END IF;

    -- 5. MATCHMAKING
    SELECT * INTO v_opponent_record
    FROM public.match_queue
    WHERE game_type = p_game_type
      AND stake_amount = p_stake_amount
      AND status = 'searching'
      AND user_id != p_user_id
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF v_opponent_record.id IS NOT NULL THEN
        DELETE FROM public.match_queue WHERE id = v_opponent_record.id;
        INSERT INTO public.matches (player1_id, player2_id, game_type, stake_amount, status, current_turn)
        VALUES (v_opponent_record.user_id, p_user_id, p_game_type, p_stake_amount, 'active', v_opponent_record.user_id)
        RETURNING id INTO v_match_id;

        RETURN jsonb_build_object('status', 'matched', 'match_id', v_match_id);
    ELSE
        INSERT INTO public.match_queue (user_id, game_type, stake_amount, status)
        VALUES (p_user_id, p_game_type, p_stake_amount, 'searching');

        RETURN jsonb_build_object('status', 'searching');
    END IF;
END;
$find_opponent_tag$ LANGUAGE plpgsql SECURITY DEFINER;

-- STEP 4: SCORE & TIMER VALIDATION

CREATE OR REPLACE FUNCTION public.validate_apple_eaten(
    p_match_id UUID,
    p_player_id UUID,
    p_x INTEGER,
    p_y INTEGER
) RETURNS JSONB AS $validate_apple_tag$
DECLARE
    v_match RECORD;
    v_new_apple_x INTEGER;
    v_new_apple_y INTEGER;
BEGIN
    -- 1. Get match details
    SELECT * INTO v_match FROM public.matches WHERE id = p_match_id FOR UPDATE;

    IF v_match.status != 'active' THEN
        RETURN jsonb_build_object('error', 'Match is not active');
    END IF;

    -- 2. Validate player position matches current apple
    IF (v_match.current_apple_pos->>'x')::int = p_x AND (v_match.current_apple_pos->>'y')::int = p_y THEN
        -- 3. Update score
        IF v_match.player1_id = p_player_id THEN
            UPDATE public.matches SET player1_score = player1_score + 10 WHERE id = p_match_id;
        ELSIF v_match.player2_id = p_player_id THEN
            UPDATE public.matches SET player2_score = player2_score + 10 WHERE id = p_match_id;
        ELSE
            RETURN jsonb_build_object('error', 'Player not in match');
        END IF;

        -- 4. Generate new apple position (simplified rnd 20x20)
        v_new_apple_x := floor(random() * 20);
        v_new_apple_y := floor(random() * 20);
        
        UPDATE public.matches 
        SET current_apple_pos = jsonb_build_object('x', v_new_apple_x, 'y', v_new_apple_y)
        WHERE id = p_match_id;

        -- 5. Return success and new apple
        RETURN jsonb_build_object(
            'status', 'success', 
            'new_apple', jsonb_build_object('x', v_new_apple_x, 'y', v_new_apple_y),
            'new_score', (CASE WHEN v_match.player1_id = p_player_id THEN v_match.player1_score + 10 ELSE v_match.player2_score + 10 END)
        );
    ELSE
        RETURN jsonb_build_object('error', 'Position mismatch');
    END IF;
END;
$validate_apple_tag$ LANGUAGE plpgsql SECURITY DEFINER;

-- STEP 4C: CHESS & CHECKERS VALIDATION

CREATE OR REPLACE FUNCTION public.perform_game_move(
    p_match_id UUID,
    p_player_id UUID,
    p_move_data JSONB
) RETURNS JSONB AS $perform_move_tag$
DECLARE
    v_match RECORD;
BEGIN
    SELECT * INTO v_match FROM public.matches WHERE id = p_match_id FOR UPDATE;

    IF v_match.status != 'active' THEN
        RETURN jsonb_build_object('error', 'Match is not active');
    END IF;

    IF v_match.current_turn != p_player_id THEN
        RETURN jsonb_build_object('error', 'Not your turn');
    END IF;

    -- Update board state and switch turn
    UPDATE public.matches 
    SET 
        board_state = p_move_data->'new_board',
        current_turn = (CASE WHEN p_player_id = player1_id THEN player2_id ELSE player1_id END),
        last_move_timestamp = NOW()
    WHERE id = p_match_id;

    -- Log move event
    INSERT INTO public.match_events (match_id, player_id, event_type, payload)
    VALUES (p_match_id, p_player_id, 'move', p_move_data);

    -- Check if game is finished
    IF p_move_data->>'status' = 'finished' THEN
        UPDATE public.matches 
        SET 
            status = 'finished',
            winner_id = p_player_id
        WHERE id = p_match_id;
        
        -- Release winnings
        PERFORM public.release_winnings(p_match_id, p_player_id);
    END IF;

    RETURN jsonb_build_object('status', 'success');
END;
$perform_move_tag$ LANGUAGE plpgsql SECURITY DEFINER;

-- STEP 4B: TIMER UPDATE FUNCTION

CREATE OR REPLACE FUNCTION public.update_game_timers(
    p_match_id UUID
) RETURNS JSONB AS $timer_update_tag$
DECLARE
    v_match RECORD;
    v_elapsed_seconds INTEGER;
    v_p1_new_time INTEGER;
    v_p2_new_time INTEGER;
BEGIN
    SELECT * INTO v_match FROM public.matches WHERE id = p_match_id FOR UPDATE;

    IF v_match.status != 'active' THEN
        RETURN jsonb_build_object('error', 'Match not active');
    END IF;

    -- Calculate elapsed time since last update
    v_elapsed_seconds := EXTRACT(EPOCH FROM (NOW() - v_match.last_move_timestamp))::int;

    IF v_elapsed_seconds < 1 THEN
        RETURN jsonb_build_object('status', 'no_change');
    END IF;

    v_p1_new_time := v_match.player1_time_remaining;
    v_p2_new_time := v_match.player2_time_remaining;

    -- For Snake, both timers run (simultaneous)
    IF v_match.game_type = 'snake' THEN
        v_p1_new_time := v_p1_new_time - v_elapsed_seconds;
        v_p2_new_time := v_p2_new_time - v_elapsed_seconds;
    ELSE
        -- For turn-based (chess), only deduct from current_turn
        IF v_match.current_turn = v_match.player1_id THEN
            v_p1_new_time := v_p1_new_time - v_elapsed_seconds;
        ELSE
            v_p2_new_time := v_p2_new_time - v_elapsed_seconds;
        END IF;
    END IF;

    -- Check for timeout
    IF v_p1_new_time <= 0 OR v_p2_new_time <= 0 THEN
        IF v_match.game_type = 'snake' THEN
            UPDATE public.matches 
            SET 
                player1_time_remaining = 0,
                player2_time_remaining = 0,
                status = 'finished',
                winner_id = (CASE 
                    WHEN player1_score > player2_score THEN player1_id 
                    WHEN player2_score > player1_score THEN player2_id 
                    ELSE NULL 
                END),
                last_move_timestamp = NOW()
            WHERE id = p_match_id;
            
            -- Release winnings if not a draw
            IF v_match.player1_score > v_match.player2_score THEN
                PERFORM public.release_winnings(p_match_id, v_match.player1_id);
            ELSIF v_match.player2_score > v_match.player1_score THEN
                PERFORM public.release_winnings(p_match_id, v_match.player2_id);
            END IF;

            RETURN jsonb_build_object(
                'status', 'finished', 
                'reason', 'timer_expired',
                'p1_score', v_match.player1_score,
                'p2_score', v_match.player2_score
            );
        ELSE
            -- Turn-based timeout (Chess/Checkers)
            UPDATE public.matches 
            SET 
                player1_time_remaining = GREATEST(0, v_p1_new_time),
                player2_time_remaining = GREATEST(0, v_p2_new_time),
                status = 'finished',
                winner_id = (CASE WHEN v_p1_new_time <= 0 THEN player2_id ELSE player1_id END),
                last_move_timestamp = NOW()
            WHERE id = p_match_id;
            
            PERFORM public.release_winnings(p_match_id, (CASE WHEN v_p1_new_time <= 0 THEN v_match.player2_id ELSE v_match.player1_id END));

            RETURN jsonb_build_object('status', 'timeout', 'winner_id', (CASE WHEN v_p1_new_time <= 0 THEN v_match.player2_id ELSE v_match.player1_id END));
        END IF;
    END IF;

    -- Update timers
    UPDATE public.matches 
    SET 
        player1_time_remaining = v_p1_new_time,
        player2_time_remaining = (CASE WHEN game_type = 'snake' THEN v_p1_new_time ELSE v_p2_new_time END),
        last_move_timestamp = NOW()
    WHERE id = p_match_id;

    RETURN jsonb_build_object('status', 'updated', 'p1_time', v_p1_new_time, 'p2_time', v_p2_new_time);
END;
$timer_update_tag$ LANGUAGE plpgsql SECURITY DEFINER;

-- STEP 5: RECONNECT & FORFEIT LOGIC

CREATE OR REPLACE FUNCTION public.handle_player_disconnection(
    p_match_id UUID,
    p_player_id UUID
) RETURNS JSONB AS $disconnection_tag$
BEGIN
    UPDATE public.matches 
    SET 
        status = 'reconnecting',
        disconnect_deadline = NOW() + INTERVAL '60 seconds'
    WHERE id = p_match_id AND status = 'active';

    RETURN jsonb_build_object('status', 'reconnecting', 'deadline', NOW() + INTERVAL '60 seconds');
END;
$disconnection_tag$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.handle_player_reconnection(
    p_match_id UUID,
    p_player_id UUID
) RETURNS JSONB AS $reconnection_tag$
BEGIN
    UPDATE public.matches 
    SET 
        status = 'active',
        disconnect_deadline = NULL
    WHERE id = p_match_id AND status = 'reconnecting';

    RETURN jsonb_build_object('status', 'active');
END;
$reconnection_tag$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cleanup function to be called periodically (cron) to forfeit abandoned matches
CREATE OR REPLACE FUNCTION public.check_forfeits() RETURNS VOID AS $forfeit_tag$
BEGIN
    UPDATE public.matches 
    SET 
        status = 'finished',
        winner_id = (CASE WHEN player1_id IS NOT NULL THEN player2_id ELSE player1_id END)
    WHERE status = 'reconnecting' AND disconnect_deadline < NOW();
END;
$forfeit_tag$ LANGUAGE plpgsql SECURITY DEFINER;

-- STEP 6: WALLET INTEGRATION & MONEY SAFETY

-- TABLE: wallets
CREATE TABLE IF NOT EXISTS public.wallets (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id),
    balance NUMERIC DEFAULT 1000.00,
    locked_balance NUMERIC DEFAULT 0.00,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS for wallets
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own wallet" ON public.wallets
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own wallet" ON public.wallets;
CREATE POLICY "Users can insert their own wallet" ON public.wallets
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- FUNCTION: lock_stake
CREATE OR REPLACE FUNCTION public.lock_stake(
    p_user_id UUID,
    p_amount NUMERIC
) RETURNS BOOLEAN AS $lock_stake_tag$
DECLARE
    v_balance NUMERIC;
BEGIN
    SELECT balance INTO v_balance FROM public.wallets WHERE user_id = p_user_id FOR UPDATE;
    
    IF v_balance >= p_amount THEN
        UPDATE public.wallets 
        SET 
            balance = balance - p_amount,
            locked_balance = locked_balance + p_amount,
            updated_at = NOW()
        WHERE user_id = p_user_id;
        RETURN TRUE;
    ELSE
        RETURN FALSE;
    END IF;
END;
$lock_stake_tag$ LANGUAGE plpgsql SECURITY DEFINER;

-- FUNCTION: release_winnings
CREATE OR REPLACE FUNCTION public.release_winnings(
    p_match_id UUID,
    p_winner_id UUID
) RETURNS VOID AS $release_tag$
DECLARE
    v_match RECORD;
    v_total_stake NUMERIC;
    v_fee NUMERIC;
    v_winner_prize NUMERIC;
BEGIN
    SELECT * INTO v_match FROM public.matches WHERE id = p_match_id FOR UPDATE;
    
    IF v_match.status != 'finished' OR v_match.winner_id IS NULL THEN
        RETURN;
    END IF;

    v_total_stake := v_match.stake_amount * 2;
    v_fee := v_total_stake * 0.10; -- 10% Platform Fee
    v_winner_prize := v_total_stake - v_fee;

    -- Unlock stake from player 1
    UPDATE public.wallets 
    SET locked_balance = locked_balance - v_match.stake_amount 
    WHERE user_id = v_match.player1_id;

    -- Unlock stake from player 2
    UPDATE public.wallets 
    SET locked_balance = locked_balance - v_match.stake_amount 
    WHERE user_id = v_match.player2_id;

    -- Award prize to winner
    UPDATE public.wallets 
    SET balance = balance + v_winner_prize 
    WHERE user_id = p_winner_id;
END;
$release_tag$ LANGUAGE plpgsql SECURITY DEFINER;

-- Automatically create a wallet for new users
CREATE OR REPLACE FUNCTION public.handle_new_user_wallet()
RETURNS TRIGGER AS $wallet_trigger_tag$
BEGIN
  INSERT INTO public.wallets (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$wallet_trigger_tag$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_wallet();

-- STEP 7: FORFEIT & REMATCH LOGIC

CREATE OR REPLACE FUNCTION public.forfeit_match(
    p_match_id UUID,
    p_player_id UUID
) RETURNS JSONB AS $forfeit_match_tag$
DECLARE
    v_match RECORD;
    v_opponent_id UUID;
BEGIN
    SELECT * INTO v_match FROM public.matches WHERE id = p_match_id FOR UPDATE;
    
    IF v_match.status != 'active' AND v_match.status != 'reconnecting' THEN
        RETURN jsonb_build_object('error', 'Match is not active');
    END IF;

    v_opponent_id := (CASE WHEN v_match.player1_id = p_player_id THEN v_match.player2_id ELSE v_match.player1_id END);

    UPDATE public.matches 
    SET 
        status = 'finished',
        winner_id = v_opponent_id,
        last_move_timestamp = NOW()
    WHERE id = p_match_id;

    -- Release winnings to opponent
    PERFORM public.release_winnings(p_match_id, v_opponent_id);

    -- Log forfeit event
    INSERT INTO public.match_events (match_id, player_id, event_type, payload)
    VALUES (p_match_id, p_player_id, 'forfeit', jsonb_build_object('forfeited_by', p_player_id));

    RETURN jsonb_build_object('status', 'success', 'winner_id', v_opponent_id);
END;
$forfeit_match_tag$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.trigger_rematch(
    p_match_id UUID
) RETURNS JSONB AS $trigger_rematch_tag$
DECLARE
    v_new_apple_x INTEGER;
    v_new_apple_y INTEGER;
BEGIN
    v_new_apple_x := floor(random() * 20);
    v_new_apple_y := floor(random() * 20);

    UPDATE public.matches 
    SET 
        player1_score = 0,
        player2_score = 0,
        player1_time_remaining = 600,
        player2_time_remaining = 600,
        status = 'active',
        winner_id = NULL,
        current_apple_pos = jsonb_build_object('x', v_new_apple_x, 'y', v_new_apple_y),
        last_move_timestamp = NOW(),
        created_at = NOW() -- Reset match age for reconnection logic
    WHERE id = p_match_id;

    RETURN jsonb_build_object('status', 'success');
END;
$trigger_rematch_tag$ LANGUAGE plpgsql SECURITY DEFINER;
