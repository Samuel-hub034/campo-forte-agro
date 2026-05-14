import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/use-auth";
import { RequireAuth } from "@/components/RequireAuth";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Beef, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";

export const Route = createFileRoute("/animais")({
  component: () => (
    <RequireAuth>
      <AppShell>
        <Animals />
      </AppShell>
    </RequireAuth>
  ),
  head: () => ({ meta: [{ title: "Rebanho — AgroGestor" }] }),
});

const TYPES = ["Boi", "Vaca", "Bezerro", "Novilho", "Touro", "Cavalo", "Outro"];

function Animals() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: animals = [], isLoading } = useQuery({
    queryKey: ["animals", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("animals")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("animals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Animal removido");
      qc.invalidateQueries({ queryKey: ["animals"] });
    },
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Rebanho"
        subtitle={`${animals.length} animais cadastrados`}
        right={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="lg" className="h-12">
                <Plus className="h-4 w-4" /> Novo
              </Button>
            </DialogTrigger>
            <NewAnimalDialog onDone={() => setOpen(false)} />
          </Dialog>
        }
      />

      {isLoading ? (
        <div className="h-32 animate-pulse rounded-2xl bg-muted" />
      ) : animals.length === 0 ? (
        <Card className="rounded-2xl">
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <Beef className="h-10 w-10 text-muted-foreground" />
            <div>
              <div className="font-semibold">Nenhum animal cadastrado</div>
              <div className="text-sm text-muted-foreground">
                Comece cadastrando o primeiro animal do seu rebanho.
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {animals.map((a) => (
            <Card key={a.id} className="rounded-2xl">
              <CardContent className="flex items-start justify-between p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">
                      {a.identifier || "Sem brinco"}
                    </span>
                    <Badge variant="secondary">{a.type}</Badge>
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {a.breed && <>Raça: {a.breed} • </>}
                    {a.weight_kg && <>{a.weight_kg} kg • </>}
                    Lote: {a.lote || "—"}
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    Status: <span className="font-medium">{a.status}</span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => remove.mutate(a.id)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function NewAnimalDialog({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    identifier: "",
    type: "Boi",
    breed: "",
    weight_kg: "",
    lote: "",
    origin: "compra",
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sem sessão");
      const { error } = await supabase.from("animals").insert({
        user_id: user.id,
        identifier: form.identifier || null,
        type: form.type,
        breed: form.breed || null,
        weight_kg: form.weight_kg ? Number(form.weight_kg) : null,
        lote: form.lote || null,
        origin: form.origin,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Animal cadastrado");
      qc.invalidateQueries({ queryKey: ["animals"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>Novo animal</DialogTitle>
      </DialogHeader>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
        className="space-y-3"
      >
        <div className="space-y-1.5">
          <Label>Identificação / Brinco</Label>
          <Input
            className="h-11"
            value={form.identifier}
            onChange={(e) => setForm({ ...form, identifier: e.target.value })}
            placeholder="Ex: BR-1234"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <Select
              value={form.type}
              onValueChange={(v) => setForm({ ...form, type: v })}
            >
              <SelectTrigger className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Raça</Label>
            <Input
              className="h-11"
              value={form.breed}
              onChange={(e) => setForm({ ...form, breed: e.target.value })}
              placeholder="Nelore"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Peso (kg)</Label>
            <Input
              className="h-11"
              type="number"
              value={form.weight_kg}
              onChange={(e) => setForm({ ...form, weight_kg: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Lote</Label>
            <Input
              className="h-11"
              value={form.lote}
              onChange={(e) => setForm({ ...form, lote: e.target.value })}
              placeholder="Lote 01"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Origem</Label>
          <Select
            value={form.origin}
            onValueChange={(v) => setForm({ ...form, origin: v })}
          >
            <SelectTrigger className="h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="compra">Compra</SelectItem>
              <SelectItem value="nascimento">Nascimento</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button type="submit" className="h-11 w-full" disabled={create.isPending}>
            {create.isPending ? "Salvando..." : "Cadastrar"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
