-- Horarios digitados pelo usuario (agenda da instalacao, data sugerida do orcamento e
-- horario da proposta/contratacao do marketplace) eram gravados em TIMESTAMP sem fuso
-- com o relogio de Sao Paulo, mas lidos pelo servidor em UTC: 09:00 aparecia 06:00.
-- Passam a TIMESTAMPTZ; o valor atual e lido como horario de Sao Paulo, entao a
-- instalacao das 09:00 continua as 09:00. So converte coluna ainda sem fuso.
-- Inicio e fim vao no mesmo ALTER para o CHECK (fim > inicio) comparar tipos iguais.
ALTER TABLE service_bookings DROP CONSTRAINT IF EXISTS service_bookings_installer_time_no_overlap;

CREATE OR REPLACE FUNCTION pg_temp.is_naive_timestamp(target_table TEXT, target_column TEXT)
RETURNS BOOLEAN
LANGUAGE sql
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema = current_schema()
      AND c.table_name = target_table
      AND c.column_name = target_column
      AND c.data_type = 'timestamp without time zone'
  );
$$;

DO $$
BEGIN
  IF pg_temp.is_naive_timestamp('schedules', 'date') THEN
    ALTER TABLE schedules
      ALTER COLUMN date TYPE TIMESTAMPTZ USING date AT TIME ZONE 'America/Sao_Paulo';
  END IF;

  IF pg_temp.is_naive_timestamp('budgets', 'schedule_date') THEN
    ALTER TABLE budgets
      ALTER COLUMN schedule_date TYPE TIMESTAMPTZ USING schedule_date AT TIME ZONE 'America/Sao_Paulo';
  END IF;

  IF pg_temp.is_naive_timestamp('service_proposals', 'scheduled_start') THEN
    ALTER TABLE service_proposals
      ALTER COLUMN scheduled_start TYPE TIMESTAMPTZ USING scheduled_start AT TIME ZONE 'America/Sao_Paulo',
      ALTER COLUMN scheduled_end TYPE TIMESTAMPTZ USING scheduled_end AT TIME ZONE 'America/Sao_Paulo';
  END IF;

  IF pg_temp.is_naive_timestamp('service_bookings', 'scheduled_start') THEN
    ALTER TABLE service_bookings
      ALTER COLUMN scheduled_start TYPE TIMESTAMPTZ USING scheduled_start AT TIME ZONE 'America/Sao_Paulo',
      ALTER COLUMN scheduled_end TYPE TIMESTAMPTZ USING scheduled_end AT TIME ZONE 'America/Sao_Paulo';
  END IF;
END $$;

ALTER TABLE service_bookings
  ADD CONSTRAINT service_bookings_installer_time_no_overlap
  EXCLUDE USING gist (
    installer_id WITH =,
    tstzrange(scheduled_start, scheduled_end, '[)') WITH &&
  )
  WHERE (status IN ('scheduled', 'in_progress'));
