"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Loader2, Plus, Sprout } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { api, Plot } from "@/lib/api";

const plotSchema = z.object({
  commodity: z.string().min(1, "Required"),
  plot_id: z.string().min(1, "Required"),
  quantity: z.coerce.number().positive("Must be positive"),
  date_planted: z.string().min(1, "Required"),
  expected_harvest_date: z.string().min(1, "Required"),
});

type PlotFormValues = z.infer<typeof plotSchema>;

export default function FarmPage() {
  const [commodities, setCommodities] = useState<string[]>([]);
  const [plots, setPlots] = useState<Plot[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [harvestingId, setHarvestingId] = useState<string | number | null>(null);

  const form = useForm<PlotFormValues>({
    resolver: zodResolver(plotSchema),
    defaultValues: {
      commodity: "",
      plot_id: "",
      quantity: 0,
      date_planted: "",
      expected_harvest_date: "",
    },
  });

  async function loadPlots() {
    try {
      const data = await api.plots("GROWING");
      setPlots(data);
    } catch {
      setPlots([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    api.commodities().then(setCommodities).catch(() => setCommodities([]));
    loadPlots();
  }, []);

  async function onSubmit(values: PlotFormValues) {
    try {
      await api.createPlot(values);
      toast.success("Plot added");
      setDialogOpen(false);
      form.reset();
      loadPlots();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add plot");
    }
  }

  async function handleHarvest(plot: Plot) {
    setHarvestingId(plot.id);
    try {
      await api.harvestPlot(plot.id, { commodity: plot.commodity, quantity: plot.quantity });
      toast.success(`Harvested plot ${plot.plot_id}`);
      loadPlots();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to harvest plot");
    } finally {
      setHarvestingId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Farm"
        description="Manage crop plots from planting to harvest"
        action={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger
              render={
                <Button>
                  <Plus className="h-4 w-4" />
                  Add Plot
                </Button>
              }
            />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add a new plot</DialogTitle>
              </DialogHeader>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label>Commodity</Label>
                  <Select
                    value={form.watch("commodity")}
                    onValueChange={(v) => form.setValue("commodity", v ?? "", { shouldValidate: true })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select commodity" />
                    </SelectTrigger>
                    <SelectContent>
                      {commodities.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.formState.errors.commodity && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.commodity.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Plot ID</Label>
                  <Input placeholder="e.g. Plot A" {...form.register("plot_id")} />
                  {form.formState.errors.plot_id && (
                    <p className="text-xs text-destructive">{form.formState.errors.plot_id.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Quantity (kg)</Label>
                  <Input type="number" step="any" {...form.register("quantity")} />
                  {form.formState.errors.quantity && (
                    <p className="text-xs text-destructive">{form.formState.errors.quantity.message}</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Date Planted</Label>
                    <Input type="date" {...form.register("date_planted")} />
                  </div>
                  <div className="space-y-2">
                    <Label>Expected Harvest</Label>
                    <Input type="date" {...form.register("expected_harvest_date")} />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={form.formState.isSubmitting}>
                    {form.formState.isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    Add Plot
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : plots.length === 0 ? (
        <Card className="border-border/60">
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <Sprout className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No growing plots yet. Add one to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plots.map((plot) => (
            <Card key={plot.id} className="border-border/60">
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle className="text-base">{plot.plot_id}</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">{plot.commodity}</p>
                </div>
                <Badge variant="secondary">Growing</Badge>
              </CardHeader>
              <CardContent className="space-y-1 text-sm text-muted-foreground">
                <p>Quantity: {plot.quantity}</p>
                {plot.date_planted && <p>Planted: {plot.date_planted}</p>}
                {plot.expected_harvest_date && <p>Expected harvest: {plot.expected_harvest_date}</p>}
              </CardContent>
              <CardFooter>
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={harvestingId === plot.id}
                  onClick={() => handleHarvest(plot)}
                >
                  {harvestingId === plot.id && <Loader2 className="h-4 w-4 animate-spin" />}
                  Harvest Now
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
