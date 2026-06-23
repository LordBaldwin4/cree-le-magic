import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, primaryRole } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Calendar, Video, ExternalLink, ScanFace } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/sessions/$id")({
  component: SessionDetail,
});

function SessionDetail() {
  const { id } = Route.useParams();
  const { user, roles } = useAuth();
  const role = primaryRole(roles);
  const qc = useQueryClient();

  const { data: session, isLoading } = useQuery({
    queryKey: ["session", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sessions")
        .select("*, classes(name, level)")
        .eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: attendances } = useQuery({
    queryKey: ["session-attendances", id],
    enabled: !!session,
    queryFn: async () => {
      const { data } = await supabase
        .from("attendances")
        .select("*, profiles!attendances_student_id_fkey(full_name, email)")
        .eq("session_id", id);
      return data ?? [];
    },
  });

  const { data: enrolled } = useQuery({
    queryKey: ["session-enrolled", session?.class_id],
    enabled: !!session?.class_id && (role === "teacher" || role === "admin"),
    queryFn: async () => {
      const { data } = await supabase
        .from("class_enrollments")
        .select("student_id, profiles!class_enrollments_student_id_fkey(full_name, email)")
        .eq("class_id", session!.class_id);
      return data ?? [];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ studentId, status }: { studentId: string; status: string }) => {
      const existing = attendances?.find((a) => a.student_id === studentId);
      if (existing) {
        const { error } = await supabase.from("attendances").update({
          status, verification_method: "manual", verified_by: user!.id,
        }).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("attendances").insert({
          session_id: id, student_id: studentId, status,
          verification_method: "manual", verified_by: user!.id,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Présence mise à jour");
      qc.invalidateQueries({ queryKey: ["session-attendances", id] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return <div className="p-10 text-sm text-muted-foreground">Chargement…</div>;
  if (!session) return <div className="p-10">Session introuvable.</div>;

  const studentAttendance = attendances?.find((a) => a.student_id === user!.id);

  return (
    <div className="mx-auto max-w-6xl p-6 lg:p-10">
      <Link to="/sessions" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Retour aux sessions
      </Link>

      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Badge variant={session.status === "live" ? "default" : "secondary"} className="mb-2">{session.status}</Badge>
          <h1 className="font-display text-3xl font-bold">{session.title}</h1>
          <p className="mt-1 text-muted-foreground">
            {(session as any).classes?.name} · {format(new Date(session.scheduled_start), "PPp", { locale: fr })}
          </p>
          {session.description && <p className="mt-3 text-sm">{session.description}</p>}
        </div>
        <div className="flex gap-2">
          {session.zoom_join_url ? (
            <a href={session.zoom_join_url} target="_blank" rel="noreferrer">
              <Button className="gap-2"><Video className="h-4 w-4" /> Rejoindre Zoom <ExternalLink className="h-3.5 w-3.5" /></Button>
            </a>
          ) : (
            <Button variant="outline" disabled className="gap-2"><Video className="h-4 w-4" /> Lien Zoom à venir</Button>
          )}
        </div>
      </div>

      {role === "student" && (
        <Card className="mb-6">
          <CardHeader><CardTitle className="font-display">Ma présence</CardTitle></CardHeader>
          <CardContent>
            {studentAttendance ? (
              <div className="flex items-center gap-3">
                <Badge variant={studentAttendance.status === "present" ? "default" : "secondary"}>
                  {studentAttendance.status}
                </Badge>
                {studentAttendance.confidence_score && (
                  <span className="text-sm text-muted-foreground">
                    Score : {studentAttendance.confidence_score}%
                  </span>
                )}
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">Validez votre présence par reconnaissance faciale.</p>
                <Link to="/face-setup">
                  <Button className="gap-2"><ScanFace className="h-4 w-4" /> Vérifier ma présence</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {(role === "teacher" || role === "admin") && (
        <Card>
          <CardHeader>
            <CardTitle className="font-display">Liste de présence ({enrolled?.length ?? 0} élèves)</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Élève</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Méthode</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enrolled?.map((e: any) => {
                  const att = attendances?.find((a) => a.student_id === e.student_id);
                  return (
                    <TableRow key={e.student_id}>
                      <TableCell className="font-medium">{e.profiles?.full_name || e.profiles?.email}</TableCell>
                      <TableCell>
                        <Badge variant={att?.status === "present" ? "default" : att?.status === "absent" ? "destructive" : "secondary"}>
                          {att?.status ?? "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{att?.verification_method ?? "—"}</TableCell>
                      <TableCell className="text-xs">{att?.confidence_score ? `${att.confidence_score}%` : "—"}</TableCell>
                      <TableCell className="text-right">
                        <Select
                          value={att?.status ?? ""}
                          onValueChange={(v) => updateStatus.mutate({ studentId: e.student_id, status: v })}
                        >
                          <SelectTrigger className="w-36"><SelectValue placeholder="Modifier" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="present">Présent</SelectItem>
                            <SelectItem value="partial">Partiel</SelectItem>
                            <SelectItem value="absent">Absent</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {enrolled?.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">Aucun élève inscrit dans cette classe.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
