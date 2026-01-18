-- Create school_years table
CREATE TABLE public.school_years (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create academic_levels table
CREATE TABLE public.academic_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  display_order INTEGER NOT NULL,
  color_code TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(name)
);

-- Create grade_series table
CREATE TABLE public.grade_series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_level_id UUID NOT NULL REFERENCES public.academic_levels(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  display_order INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create class_planning table
CREATE TABLE public.class_planning (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_year_id UUID NOT NULL REFERENCES public.school_years(id) ON DELETE CASCADE,
  grade_series_id UUID NOT NULL REFERENCES public.grade_series(id) ON DELETE CASCADE,
  scenario_name TEXT NOT NULL DEFAULT 'Cenário Atual',
  shift TEXT NOT NULL CHECK (shift IN ('Manhã', 'Tarde', 'Integral', 'Noite')),
  total_classes INTEGER NOT NULL CHECK (total_classes >= 0),
  vacancies_per_class INTEGER NOT NULL CHECK (vacancies_per_class >= 0),
  re_enrolled_students INTEGER NOT NULL DEFAULT 0 CHECK (re_enrolled_students >= 0),
  new_students INTEGER NOT NULL DEFAULT 0 CHECK (new_students >= 0),
  transferred_students INTEGER NOT NULL DEFAULT 0 CHECK (transferred_students >= 0),
  waiting_list INTEGER NOT NULL DEFAULT 0 CHECK (waiting_list >= 0),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(school_year_id, grade_series_id, shift, scenario_name)
);

-- Create complementary_programs table
CREATE TABLE public.complementary_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_year_id UUID NOT NULL REFERENCES public.school_years(id) ON DELETE CASCADE,
  program_name TEXT NOT NULL,
  total_vacancies INTEGER NOT NULL CHECK (total_vacancies >= 0),
  enrolled_students INTEGER NOT NULL DEFAULT 0 CHECK (enrolled_students >= 0),
  waiting_list INTEGER NOT NULL DEFAULT 0 CHECK (waiting_list >= 0),
  color_code TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(school_year_id, program_name)
);

-- Enable RLS
ALTER TABLE public.school_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grade_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_planning ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.complementary_programs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for school_years
CREATE POLICY "Authenticated users can view school years"
  ON public.school_years FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and coordinators can manage school years"
  ON public.school_years FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'coordinator'));

-- RLS Policies for academic_levels
CREATE POLICY "Authenticated users can view academic levels"
  ON public.academic_levels FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage academic levels"
  ON public.academic_levels FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for grade_series
CREATE POLICY "Authenticated users can view grade series"
  ON public.grade_series FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage grade series"
  ON public.grade_series FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for class_planning
CREATE POLICY "Authenticated users can view class planning"
  ON public.class_planning FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and coordinators can manage class planning"
  ON public.class_planning FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'coordinator'));

-- RLS Policies for complementary_programs
CREATE POLICY "Authenticated users can view complementary programs"
  ON public.complementary_programs FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins and coordinators can manage complementary programs"
  ON public.complementary_programs FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'coordinator'));

-- Triggers for updated_at
CREATE TRIGGER update_school_years_updated_at
  BEFORE UPDATE ON public.school_years
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_academic_levels_updated_at
  BEFORE UPDATE ON public.academic_levels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_grade_series_updated_at
  BEFORE UPDATE ON public.grade_series
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_class_planning_updated_at
  BEFORE UPDATE ON public.class_planning
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_complementary_programs_updated_at
  BEFORE UPDATE ON public.complementary_programs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default academic levels with La Salle colors
INSERT INTO public.academic_levels (name, display_order, color_code) VALUES
  ('Educação Infantil', 1, '#0066CC'),
  ('Ensino Fundamental I', 2, '#0066CC'),
  ('Ensino Fundamental II', 3, '#0066CC'),
  ('Ensino Médio', 4, '#0066CC');

-- Insert default grade series
INSERT INTO public.grade_series (academic_level_id, name, display_order)
SELECT id, 'Maternal I', 1 FROM public.academic_levels WHERE name = 'Educação Infantil'
UNION ALL
SELECT id, 'Maternal II', 2 FROM public.academic_levels WHERE name = 'Educação Infantil'
UNION ALL
SELECT id, 'Nível I', 3 FROM public.academic_levels WHERE name = 'Educação Infantil'
UNION ALL
SELECT id, 'Nível II', 4 FROM public.academic_levels WHERE name = 'Educação Infantil'
UNION ALL
SELECT id, '1º Ano', 1 FROM public.academic_levels WHERE name = 'Ensino Fundamental I'
UNION ALL
SELECT id, '2º Ano', 2 FROM public.academic_levels WHERE name = 'Ensino Fundamental I'
UNION ALL
SELECT id, '3º Ano', 3 FROM public.academic_levels WHERE name = 'Ensino Fundamental I'
UNION ALL
SELECT id, '4º Ano', 4 FROM public.academic_levels WHERE name = 'Ensino Fundamental I'
UNION ALL
SELECT id, '5º Ano', 5 FROM public.academic_levels WHERE name = 'Ensino Fundamental I'
UNION ALL
SELECT id, '6º Ano', 1 FROM public.academic_levels WHERE name = 'Ensino Fundamental II'
UNION ALL
SELECT id, '7º Ano', 2 FROM public.academic_levels WHERE name = 'Ensino Fundamental II'
UNION ALL
SELECT id, '8º Ano', 3 FROM public.academic_levels WHERE name = 'Ensino Fundamental II'
UNION ALL
SELECT id, '9º Ano', 4 FROM public.academic_levels WHERE name = 'Ensino Fundamental II'
UNION ALL
SELECT id, '1ª Série', 1 FROM public.academic_levels WHERE name = 'Ensino Médio'
UNION ALL
SELECT id, '2ª Série', 2 FROM public.academic_levels WHERE name = 'Ensino Médio'
UNION ALL
SELECT id, '3ª Série', 3 FROM public.academic_levels WHERE name = 'Ensino Médio';

-- Create active school year 2026
INSERT INTO public.school_years (year, is_active) VALUES (2026, true);