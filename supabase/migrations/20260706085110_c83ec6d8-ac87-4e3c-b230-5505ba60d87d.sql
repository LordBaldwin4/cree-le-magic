
-- Allow teachers to manage enrollments in their own classes so students can see the sessions.
CREATE POLICY "enrollments_teacher_manage"
ON public.class_enrollments FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.classes c WHERE c.id = class_enrollments.class_id AND c.created_by = auth.uid())
  OR EXISTS (SELECT 1 FROM public.class_teachers ct WHERE ct.class_id = class_enrollments.class_id AND ct.teacher_id = auth.uid())
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.classes c WHERE c.id = class_enrollments.class_id AND c.created_by = auth.uid())
  OR EXISTS (SELECT 1 FROM public.class_teachers ct WHERE ct.class_id = class_enrollments.class_id AND ct.teacher_id = auth.uid())
);
