-- Create Settlements Table
CREATE TABLE IF NOT EXISTS public.settlements (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    firm_id UUID NOT NULL REFERENCES public.firms(id) ON DELETE CASCADE,
    member_id BIGINT REFERENCES public.members(id) ON DELETE SET NULL,
    group_id BIGINT REFERENCES public.groups(id) ON DELETE SET NULL,
    total_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
    total_months INTEGER NOT NULL DEFAULT 1,
    average_per_month DECIMAL(15,2) NOT NULL DEFAULT 0,
    month_14_balance DECIMAL(15,2) NOT NULL DEFAULT 0,
    entries JSONB NOT NULL DEFAULT '[]'::jsonb,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Enable RLS
ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;

-- Scoped Policies (Scoped to firm_id)
CREATE POLICY "Users can view settlements for their firm" 
ON public.settlements FOR SELECT 
USING (firm_id = (SELECT firm_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert settlements for their firm" 
ON public.settlements FOR INSERT 
WITH CHECK (firm_id = (SELECT firm_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete settlements for their firm" 
ON public.settlements FOR DELETE 
USING (firm_id = (SELECT firm_id FROM public.profiles WHERE id = auth.uid()));

-- Multi-Tenant Index
CREATE INDEX IF NOT EXISTS idx_settlements_firm_id ON public.settlements (firm_id);
