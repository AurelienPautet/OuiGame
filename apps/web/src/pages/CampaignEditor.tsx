import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Save,
  X,
  ArrowUp,
  ArrowDown,
  Trash2,
  GripVertical,
  Swords,
  Layers,
} from "lucide-react";
import { useModal, useAuth, useToast, MODALS } from "../contexts";
import { LevelSelector } from "../components/ui";
import {
  IoTitle,
  Input,
  Button,
  IconButton,
} from "../components/ui/primitives";
import { useCampaign, useSaveCampaign } from "../hooks/api";
import type { LevelDTO } from "@ouigame/shared/api";
import type { ApiRequestError } from "../api/client";
import { cn } from "../lib/cn";

// One entry in the ordered campaign list the editor builds.
interface PickedLevel {
  id: number;
  name: string;
}

export const CampaignEditor = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const campaignId = searchParams.get("id");

  const { user } = useAuth();
  const { openModal } = useModal();
  const { addToast, TOAST_TYPES } = useToast();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  // picked: ordered array of { id, name }
  const [picked, setPicked] = useState<PickedLevel[]>([]);
  const [saving, setSaving] = useState(false);
  // Drag-and-drop reordering state
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const saveCampaign = useSaveCampaign();
  // 0 (falsy) keeps the query disabled (enabled: !!id) when there's no id.
  const { data: campaignData } = useCampaign(
    campaignId ? parseInt(campaignId) : 0
  );

  // Prefill when editing an existing campaign
  useEffect(() => {
    if (campaignData) {
      setName(campaignData.campaign_name || "");
      setDescription(campaignData.campaign_description || "");
      setPicked(
        (campaignData.levels || []).map((l) => ({
          id: l.level_id,
          name: l.level_name,
        }))
      );
    }
  }, [campaignData]);

  const pickedIds = picked.map((p) => p.id);

  // Clicking a level card toggles it in/out of the campaign
  const handlePick = (level: LevelDTO) => {
    setPicked((prev) =>
      prev.some((p) => p.id === level.level_id)
        ? prev.filter((p) => p.id !== level.level_id)
        : [...prev, { id: level.level_id, name: level.level_name }]
    );
  };

  const move = (index: number, delta: number) => {
    setPicked((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      const a = next[index];
      const b = next[target];
      // index is a valid map index and target was just bounds-checked, so both are defined.
      if (a === undefined || b === undefined) return prev;
      next[index] = b;
      next[target] = a;
      return next;
    });
  };

  const remove = (id: number) => {
    setPicked((prev) => prev.filter((p) => p.id !== id));
  };

  // Move the currently dragged item to `toIndex` (drop target).
  const reorderTo = (toIndex: number) => {
    setPicked((prev) => {
      if (dragIndex === null || dragIndex === toIndex) return prev;
      const next = [...prev];
      const [moved] = next.splice(dragIndex, 1);
      if (moved === undefined) return prev;
      next.splice(toIndex, 0, moved);
      return next;
    });
    setDragIndex(null);
    setOverIndex(null);
  };

  const endDrag = () => {
    setDragIndex(null);
    setOverIndex(null);
  };

  const handleClose = () => {
    navigate("/");
    openModal(MODALS.MY_CAMPAIGNS);
  };

  const handleSave = () => {
    if (!name.trim()) {
      addToast(
        TOAST_TYPES.ERROR,
        t("campaignEditor.toast.title"),
        t("campaignEditor.toast.nameEmpty")
      );
      return;
    }
    if (picked.length < 1) {
      addToast(
        TOAST_TYPES.ERROR,
        t("campaignEditor.toast.title"),
        t("campaignEditor.toast.addOne")
      );
      return;
    }

    setSaving(true);
    saveCampaign.mutate(
      {
        ...(campaignId ? { id: parseInt(campaignId) } : {}),
        name: name.trim(),
        description,
        levelIds: pickedIds,
      },
      {
        onSuccess: () => {
          setSaving(false);
          addToast(
            TOAST_TYPES.SUCCESS,
            t("campaignEditor.toast.title"),
            t("campaignEditor.toast.saved")
          );
          navigate("/");
          openModal(MODALS.MY_CAMPAIGNS);
        },
        onError: (err: Error) => {
          setSaving(false);
          // A 409 is the one case worth calling out specifically (duplicate
          // name); everything else gets a generic localized message — never the
          // server's raw English `error` text.
          const apiErr = err as ApiRequestError;
          const msg =
            apiErr.status === 409
              ? t("campaignEditor.toast.nameTaken")
              : t("campaignEditor.toast.failedSave");
          addToast(TOAST_TYPES.ERROR, t("campaignEditor.toast.title"), msg);
        },
      }
    );
  };

  if (!user) {
    return (
      <div className="w-full h-full bg-ink text-white flex flex-col items-center justify-center gap-4 graph-paper">
        <IoTitle className="text-3xl">{t("campaignEditor.fullTitle")}</IoTitle>
        <p className="text-ink bg-white/80 px-3 py-1 rounded-lg font-semibold">
          {t("campaignEditor.loginToCreate")}
        </p>
        <Button variant="ghost" onClick={() => navigate("/")}>
          {t("common.back")}
        </Button>
      </div>
    );
  }

  const canSave = !saving && !!name.trim() && picked.length >= 1;

  return (
    <div className="w-full h-full graph-paper text-ink flex flex-col">
      {/* Header */}
      <div className="h-24 bg-white flex items-center justify-between px-8 gap-4 border-b-4 border-ink shrink-0">
        <div className="flex items-center gap-3 whitespace-nowrap">
          <span className="bg-blue/20 text-blue border-[3px] border-ink rounded-lg p-2">
            <Swords className="w-6 h-6" />
          </span>
          <IoTitle className="text-xl">
            {t("campaignEditor.headerTitle")}
          </IoTitle>
        </div>

        <div className="flex items-center gap-3 flex-1 justify-center max-w-2xl">
          <Input
            className="w-56"
            placeholder={t("campaignEditor.namePlaceholder")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={30}
          />
          <Input
            className="flex-1"
            placeholder={t("campaignEditor.descriptionPlaceholder")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={300}
          />
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="green"
            onClick={handleSave}
            disabled={!canSave}
            title={t("campaignEditor.saveCampaign")}
          >
            <Save size={18} />
            {saving ? t("common.saving") : t("common.save")}
          </Button>
          <IconButton onClick={handleClose} title={t("common.close")}>
            <X size={20} className="text-red" />
          </IconButton>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex min-h-0 gap-4 p-4 graph-paper">
        {/* Level picker */}
        <div className="flex-1 min-w-0 flex flex-col bg-white border-4 border-ink rounded-arcade shadow-arcade p-4">
          <h2 className="text-lg font-bold text-ink mb-3">
            {t("campaignEditor.addSoloLevels")}{" "}
            <span className="text-sm font-normal text-ink-soft">
              {t("campaignEditor.clickToAddRemove")}
            </span>
          </h2>
          <div className="flex-1 min-h-0">
            <LevelSelector
              mode="pick"
              onPick={handlePick}
              pickedIds={pickedIds}
            />
          </div>
        </div>

        {/* Ordered campaign list */}
        <div className="w-96 flex flex-col bg-white border-4 border-ink rounded-arcade shadow-arcade p-4 min-h-0">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-ink">
              {t("campaignEditor.campaignLevels")}
            </h2>
            <span className="inline-flex items-center justify-center min-w-8 h-8 px-2 bg-blue text-white border-[3px] border-ink rounded-full font-bold">
              {picked.length}
            </span>
          </div>
          <p className="text-xs text-ink-soft mt-1 mb-3 flex items-center gap-1">
            <GripVertical className="w-3 h-3" />
            {t("campaignEditor.dragToReorder")}
          </p>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {picked.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-ink-soft gap-3 border-2 border-dashed border-ink/20 rounded-xl p-6">
                <Layers className="w-10 h-10 opacity-50" />
                <p className="text-sm">
                  {t("campaignEditor.noLevels")}
                  <br />
                  {t("campaignEditor.noLevelsHint")}
                </p>
              </div>
            ) : (
              picked.map((p, index) => (
                <div
                  key={p.id}
                  draggable
                  onDragStart={(e) => {
                    setDragIndex(index);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    if (overIndex !== index) setOverIndex(index);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    reorderTo(index);
                  }}
                  onDragEnd={endDrag}
                  className={cn(
                    "group flex items-center gap-2 rounded-lg p-2 bg-field border-2 transition-all cursor-grab active:cursor-grabbing",
                    dragIndex === index
                      ? "opacity-40 border-ink"
                      : "border-ink/30 hover:border-ink/60",
                    overIndex === index &&
                      dragIndex !== index &&
                      "ring-2 ring-blue border-blue"
                  )}
                >
                  <GripVertical className="w-4 h-4 text-ink/40 shrink-0" />
                  <span className="flex items-center justify-center w-6 h-6 shrink-0 rounded-full bg-blue text-white text-xs font-bold border-2 border-ink">
                    {index + 1}
                  </span>
                  <span className="flex-1 truncate text-sm text-ink font-medium">
                    {p.name}
                  </span>
                  <div className="flex items-center gap-1 opacity-50 group-hover:opacity-100 transition-opacity">
                    <IconButton
                      size="sm"
                      onClick={() => move(index, -1)}
                      disabled={index === 0}
                      title={t("campaignEditor.moveUp")}
                    >
                      <ArrowUp className="w-4 h-4" />
                    </IconButton>
                    <IconButton
                      size="sm"
                      onClick={() => move(index, 1)}
                      disabled={index === picked.length - 1}
                      title={t("campaignEditor.moveDown")}
                    >
                      <ArrowDown className="w-4 h-4" />
                    </IconButton>
                    <IconButton
                      size="sm"
                      onClick={() => remove(p.id)}
                      title={t("campaignEditor.remove")}
                    >
                      <Trash2 className="w-4 h-4 text-red" />
                    </IconButton>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
