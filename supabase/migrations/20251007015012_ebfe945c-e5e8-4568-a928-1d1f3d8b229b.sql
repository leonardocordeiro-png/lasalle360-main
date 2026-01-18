-- Create enums for council module
CREATE TYPE public.academic_level_enum AS ENUM ('EM', 'EFII');
CREATE TYPE public.trimester_enum AS ENUM ('1', '2', '3');
CREATE TYPE public.council_status_enum AS ENUM ('draft', 'in_progress', 'completed', 'approved');
CREATE TYPE public.grade_status_enum AS ENUM ('AP', 'REC', '-');
CREATE TYPE public.action_type_enum AS ENUM ('pais_chamados', 'soe_acompanhar', 'sct_chamar', 'destaques');
CREATE TYPE public.signature_role_enum AS ENUM ('prof_reg', 'sse', 'soe', 'sct', 'scp');

-- Create class_councils table
CREATE TABLE public.class_councils (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_year_id UUID REFERENCES public.school_years(id) ON DELETE CASCADE NOT NULL,
  academic_level academic_level_enum NOT NULL,
  trimester trimester_enum NOT NULL,
  grade_class TEXT NOT NULL,
  council_date DATE NOT NULL,
  status council_status_enum NOT NULL DEFAULT 'draft',
  created_by UUID NOT NULL,
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(school_year_id, academic_level, trimester, grade_class)
);

-- Create council_subjects table
CREATE TABLE public.council_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_level academic_level_enum NOT NULL,
  subject_code TEXT NOT NULL,
  subject_name TEXT NOT NULL,
  display_order INTEGER NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(academic_level, subject_code)
);

-- Create council_students table
CREATE TABLE public.council_students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  council_id UUID REFERENCES public.class_councils(id) ON DELETE CASCADE NOT NULL,
  student_number INTEGER NOT NULL,
  student_name TEXT NOT NULL,
  display_order INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create council_grades table
CREATE TABLE public.council_grades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  council_student_id UUID REFERENCES public.council_students(id) ON DELETE CASCADE NOT NULL,
  subject_id UUID REFERENCES public.council_subjects(id) ON DELETE CASCADE NOT NULL,
  grade_status grade_status_enum,
  observations TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(council_student_id, subject_id)
);

-- Create council_actions table
CREATE TABLE public.council_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  council_id UUID REFERENCES public.class_councils(id) ON DELETE CASCADE NOT NULL,
  action_type action_type_enum NOT NULL,
  trimester trimester_enum NOT NULL,
  student_names TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create council_signatures table
CREATE TABLE public.council_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  council_id UUID REFERENCES public.class_councils(id) ON DELETE CASCADE NOT NULL,
  role signature_role_enum NOT NULL,
  signed_by UUID NOT NULL,
  signed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  signature_data TEXT,
  UNIQUE(council_id, role)
);

-- Enable RLS on all tables
ALTER TABLE public.class_councils ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.council_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.council_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.council_grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.council_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.council_signatures ENABLE ROW LEVEL SECURITY;

-- RLS Policies for class_councils
CREATE POLICY "Authenticated users can view councils"
  ON public.class_councils FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can create councils"
  ON public.class_councils FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Creators and admins can update councils"
  ON public.class_councils FOR UPDATE
  USING (
    auth.uid() = created_by OR 
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'coordinator')
  );

CREATE POLICY "Admins can delete councils"
  ON public.class_councils FOR DELETE
  USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for council_subjects
CREATE POLICY "Authenticated users can view subjects"
  ON public.council_subjects FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage subjects"
  ON public.council_subjects FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for council_students
CREATE POLICY "Authenticated users can view students in councils"
  ON public.council_students FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authorized users can manage students in councils"
  ON public.council_students FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.class_councils
      WHERE id = council_id
      AND (created_by = auth.uid() OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'coordinator'))
    )
  );

-- RLS Policies for council_grades
CREATE POLICY "Authenticated users can view grades"
  ON public.council_grades FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authorized users can manage grades"
  ON public.council_grades FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.council_students cs
      JOIN public.class_councils cc ON cc.id = cs.council_id
      WHERE cs.id = council_student_id
      AND (cc.created_by = auth.uid() OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'coordinator'))
    )
  );

-- RLS Policies for council_actions
CREATE POLICY "Authenticated users can view actions"
  ON public.council_actions FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authorized users can manage actions"
  ON public.council_actions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.class_councils
      WHERE id = council_id
      AND (created_by = auth.uid() OR has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'coordinator'))
    )
  );

-- RLS Policies for council_signatures
CREATE POLICY "Authenticated users can view signatures"
  ON public.council_signatures FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can sign councils"
  ON public.council_signatures FOR INSERT
  WITH CHECK (auth.uid() = signed_by);

CREATE POLICY "Admins can manage signatures"
  ON public.council_signatures FOR ALL
  USING (has_role(auth.uid(), 'admin'));

-- Add triggers for updated_at
CREATE TRIGGER update_class_councils_updated_at
  BEFORE UPDATE ON public.class_councils
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_council_subjects_updated_at
  BEFORE UPDATE ON public.council_subjects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_council_students_updated_at
  BEFORE UPDATE ON public.council_students
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_council_grades_updated_at
  BEFORE UPDATE ON public.council_grades
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_council_actions_updated_at
  BEFORE UPDATE ON public.council_actions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default subjects for EM (Ensino Médio)
INSERT INTO public.council_subjects (academic_level, subject_code, subject_name, display_order) VALUES
('EM', 'L. PORT', 'Língua Portuguesa', 1),
('EM', 'MAT', 'Matemática', 2),
('EM', 'QUIM', 'Química', 3),
('EM', 'FIS', 'Física', 4),
('EM', 'BIO', 'Biologia', 5),
('EM', 'HIS', 'História', 6),
('EM', 'GEO', 'Geografia', 7),
('EM', 'FIL', 'Filosofia', 8),
('EM', 'SOC', 'Sociologia', 9),
('EM', 'ING', 'Inglês', 10),
('EM', 'ESP', 'Espanhol', 11),
('EM', 'ED. FIS', 'Educação Física', 12),
('EM', 'ARTE', 'Arte', 13),
('EM', 'LIT', 'Literatura', 14),
('EM', 'RED', 'Redação', 15),
('EM', 'INT. TXT', 'Interpretação de Texto', 16),
('EM', 'PV', 'Projeto de Vida', 17),
('EM', 'INF', 'Informática', 18),
('EM', 'ROBÓT', 'Robótica', 19),
('EM', 'PAST', 'Pastoral', 20),
('EM', 'EMP', 'Empreendedorismo', 21),
('EM', 'P. FLUÊNCIA', 'Pensamento Fluência', 22),
('EM', 'CIENTÍF', 'Científica', 23);

-- Insert default subjects for EFII (Ensino Fundamental II)
INSERT INTO public.council_subjects (academic_level, subject_code, subject_name, display_order) VALUES
('EFII', 'L. PORT', 'Língua Portuguesa', 1),
('EFII', 'MAT', 'Matemática', 2),
('EFII', 'CIEN', 'Ciências', 3),
('EFII', 'HIS', 'História', 4),
('EFII', 'GEO', 'Geografia', 5),
('EFII', 'ING', 'Inglês', 6),
('EFII', 'ESP', 'Espanhol', 7),
('EFII', 'ED. FIS', 'Educação Física', 8),
('EFII', 'ARTE', 'Arte', 9),
('EFII', 'ENS. REL', 'Ensino Religioso', 10),
('EFII', 'MÚS', 'Música', 11),
('EFII', 'TEC', 'Tecnologia', 12),
('EFII', 'PV', 'Projeto de Vida', 13),
('EFII', 'PAST', 'Pastoral', 14);