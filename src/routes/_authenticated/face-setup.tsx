import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Camera, ScanFace, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/face-setup")({
  head: () => ({ meta: [{ title: "Profil facial — FacePresence" }] }),
  component: FaceSetupPage,
});

function FaceSetupPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["face-profile", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("face_profiles").select("*").eq("student_id", user!.id).maybeSingle();
      return data;
    },
  });

  useEffect(() => () => stream?.getTracks().forEach((t) => t.stop()), [stream]);

  async function startCamera() {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 640 } } });
      setStream(s);
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        await videoRef.current.play().catch(() => {});
      }
    } catch {
      toast.error("Impossible d'accéder à la webcam");
    }
  }

  function capture() {
    const v = videoRef.current;
    if (!v) return;
    const w = v.videoWidth;
    const h = v.videoHeight;
    if (!w || !h) {
      toast.error("La webcam n'est pas encore prête, réessayez dans une seconde.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(v, 0, 0, w, h);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    if (!dataUrl || dataUrl.length < 100) {
      toast.error("Capture échouée, réessayez.");
      return;
    }
    setCapturedImage(dataUrl);
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
  }

  const saveProfile = useMutation({
    mutationFn: async () => {
      if (!capturedImage || !capturedImage.startsWith("data:image")) throw new Error("Capture invalide, recommencez.");
      setEnrolling(true);
      // Phase 1 : enregistrement local. L'indexation AWS Rekognition sera branchée
      // une fois les identifiants AWS fournis par l'administrateur.
      const payload = {
        student_id: user!.id,
        image_url: capturedImage, // base64 placeholder, sera remplacé par URL S3
        rekognition_external_id: user!.id,
      };
      const { error } = await supabase
        .from("face_profiles")
        .upsert(payload, { onConflict: "student_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profil facial enregistré");
      qc.invalidateQueries({ queryKey: ["face-profile", user?.id] });
      setCapturedImage(null);
    },
    onError: (e: any) => toast.error(e.message),
    onSettled: () => setEnrolling(false),
  });

  return (
    <div className="mx-auto max-w-3xl p-6 lg:p-10">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold">Mon profil facial</h1>
        <p className="mt-1 text-muted-foreground">
          Enregistrez une photo de référence pour permettre la vérification automatique de votre présence aux cours.
        </p>
      </div>

      <Card className="mb-6 border-warning/40 bg-warning/5">
        <CardContent className="flex items-start gap-3 p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-warning-foreground" />
          <p>
            <strong>Mode démo :</strong> votre photo est stockée dans la base. L'indexation AWS Rekognition
            sera activée dès que l'administrateur aura fourni les identifiants AWS.
          </p>
        </CardContent>
      </Card>

      {profile?.image_url && (
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="font-display">Profil actuel</CardTitle>
              <Badge variant={profile.rekognition_face_id ? "default" : "secondary"}>
                {profile.rekognition_face_id ? "Indexé AWS" : "En attente d'indexation"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <img src={profile.image_url} alt="Profil facial" className="h-48 w-48 rounded-lg object-cover" />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="font-display flex items-center gap-2">
            <ScanFace className="h-5 w-5 text-primary" />
            {profile ? "Mettre à jour ma photo" : "Enregistrer ma photo"}
          </CardTitle>
          <CardDescription>Positionnez votre visage de face, dans un environnement bien éclairé.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid place-items-center">
            {capturedImage ? (
              <>
                <img src={capturedImage} alt="Capture" className="aspect-square w-full max-w-sm rounded-xl object-cover" />
                <div className="mt-4 flex gap-2">
                  <Button variant="outline" onClick={() => { setCapturedImage(null); startCamera(); }}>Reprendre</Button>
                  <Button onClick={() => saveProfile.mutate()} disabled={enrolling}>
                    {enrolling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <CheckCircle2 className="mr-2 h-4 w-4" /> Valider et enregistrer
                  </Button>
                </div>
              </>
            ) : stream ? (
              <>
                <video ref={videoRef} autoPlay playsInline className="aspect-square w-full max-w-sm rounded-xl bg-muted object-cover" />
                <Button onClick={capture} className="mt-4 gap-2"><Camera className="h-4 w-4" /> Capturer</Button>
              </>
            ) : (
              <div className="flex flex-col items-center gap-3 py-10">
                <div className="grid h-16 w-16 place-items-center rounded-full bg-primary-soft text-primary">
                  <Camera className="h-7 w-7" />
                </div>
                <Button onClick={startCamera} className="gap-2"><Camera className="h-4 w-4" /> Activer la webcam</Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
