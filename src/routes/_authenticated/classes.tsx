import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, primaryRole } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, GraduationCap, UserPlus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/classes")({
  head: () => ({ meta: [{ title: "Classes — FacePresence" }] }),
  component: ClassesPage,
});

function ClassesPage() {
  const { roles } = useAuth();
  const role = primaryRole(roles);
  const isAdmin = role === "admin";

  const { data: classes } = useQuery({
    queryKey: ["classes-list"],
    queryFn: async () => {
      const { data } = await supabase.from("classes").select("*").order("name");
      return data ?? [];
    },
  });

  return (
    <div className="mx-auto max-w-7xl p-6 lg:p-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Classes</h1>
          <p className="mt-1 text-muted-foreground">Gestion des classes et inscriptions.</p>
        </div>
        {isAdmin && <CreateClassDialog />}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {classes?.map((c) => <ClassCard key={c.id} classRow={c} isAdmin={isAdmin} />)}
        {classes?.length === 0 && (
          <Card className="md:col-span-2 lg:col-span-3">
            <CardContent className="grid place-items-center gap-3 py-16 text-center">
              <div className="grid h-12 w-12 place-items-center rounded-full bg-primary-soft text-primary">
                <GraduationCap className="h-6 w-6" />
              </div>
              <p className="font-medium">Aucune classe</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function ClassCard({ classRow, isAdmin }: { classRow: any; isAdmin: boolean }) {
  const qc = useQueryClient();
  const { data: enrollments } = useQuery({
    queryKey: ["class-enrollments", classRow.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("class_enrollments")
        .select("id, student_id, profiles!class_enrollments_student_id_fkey(full_name, email)")
        .eq("class_id", classRow.id);
      return data ?? [];
    },
  });

  const removeEnrollment = useMutation({
    mutationFn: async (enrollmentId: string) => {
      const { error } = await supabase.from("class_enrollments").delete().eq("id", enrollmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["class-enrollments", classRow.id] });
      toast.success("Élève retiré");
    },
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="font-display">{classRow.name}</CardTitle>
          <Badge variant="secondary">{enrollments?.length ?? 0} élèves</Badge>
        </div>
        {classRow.level && <p className="text-sm text-muted-foreground">{classRow.level}</p>}
      </CardHeader>
      <CardContent>
        {classRow.description && <p className="mb-3 text-sm text-muted-foreground">{classRow.description}</p>}
        <ul className="space-y-1.5">
          {enrollments?.slice(0, 5).map((e: any) => (
            <li key={e.id} className="flex items-center justify-between text-sm">
              <span>{e.profiles?.full_name || e.profiles?.email}</span>
              {isAdmin && (
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeEnrollment.mutate(e.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </li>
          ))}
          {enrollments && enrollments.length > 5 && (
            <li className="text-xs text-muted-foreground">+{enrollments.length - 5} autres</li>
          )}
          {enrollments?.length === 0 && <li className="text-xs text-muted-foreground">Aucun élève inscrit.</li>}
        </ul>
        {isAdmin && <EnrollDialog classId={classRow.id} />}
      </CardContent>
    </Card>
  );
}

function CreateClassDialog() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [level, setLevel] = useState("");
  const [description, setDescription] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("classes").insert({ name, level, description, created_by: user!.id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Classe créée");
      qc.invalidateQueries({ queryKey: ["classes-list"] });
      setOpen(false); setName(""); setLevel(""); setDescription("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" /> Nouvelle classe</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Créer une classe</DialogTitle></DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); create.mutate(); }} className="space-y-4">
          <div className="space-y-2"><Label>Nom</Label><Input value={name} onChange={(e) => setName(e.target.value)} required /></div>
          <div className="space-y-2"><Label>Niveau</Label><Input value={level} onChange={(e) => setLevel(e.target.value)} placeholder="ex. Terminale S" /></div>
          <div className="space-y-2"><Label>Description</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <DialogFooter><Button type="submit" disabled={create.isPending}>Créer</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EnrollDialog({ classId }: { classId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [studentId, setStudentId] = useState("");

  const { data: students } = useQuery({
    queryKey: ["students-for-enroll"],
    enabled: open,
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "student");
      const ids = (roles ?? []).map((r) => r.user_id);
      if (!ids.length) return [];
      const { data } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
      return data ?? [];
    },
  });

  const enroll = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("class_enrollments").insert({ class_id: classId, student_id: studentId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Élève inscrit");
      qc.invalidateQueries({ queryKey: ["class-enrollments", classId] });
      setOpen(false); setStudentId("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="mt-3 w-full gap-2"><UserPlus className="h-3.5 w-3.5" /> Inscrire un élève</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Inscrire un élève</DialogTitle></DialogHeader>
        <Select value={studentId} onValueChange={setStudentId}>
          <SelectTrigger><SelectValue placeholder="Choisir un élève" /></SelectTrigger>
          <SelectContent>
            {students?.map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name || s.email}</SelectItem>)}
          </SelectContent>
        </Select>
        <DialogFooter><Button disabled={!studentId || enroll.isPending} onClick={() => enroll.mutate()}>Inscrire</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
