import { useEffect, useRef, useState } from "react";
import { Copy, Globe, Lock, Share2 } from "lucide-react";
import type { Recipe } from "../engine/types";
import type { SavedRecipe, Visibility } from "../sharing";

export default function RecipeSharing({
  recipe,
  stored,
  busy,
  error,
  onVisibility,
}: {
  recipe: Recipe;
  stored?: SavedRecipe;
  busy: boolean;
  error: string;
  onVisibility: (visibility: Visibility) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const isPublic =
    stored?.access.owned && stored.access.visibility === "public";
  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);
  useEffect(() => {
    setOpen(false);
    setStatus("");
  }, [recipe.id]);
  async function copyLink() {
    const url = new URL(window.location.href);
    url.search = "";
    url.hash = "";
    url.searchParams.set("recipe", recipe.id);
    try {
      await navigator.clipboard.writeText(url.toString());
      setStatus("Share link copied.");
    } catch {
      setStatus("Copy this link: " + url.toString());
    }
  }
  return (
    <>
      <div className="recipe-sharing">
        <div className="recipe-sharing-status">
          {isPublic ? <Globe size={18} /> : <Lock size={18} />}
          <div>
            <b>
              {isPublic
                ? "Shared publicly"
                : stored?.access.owned
                  ? "Saved privately"
                  : "Private draft"}
            </b>
            <p>
              {isPublic
                ? "Anyone can view this recipe. Saving updates its public version."
                : "Saving keeps this recipe private. Sharing is your choice."}
            </p>
          </div>
        </div>
        <div className="sharing-actions">
          {isPublic ? (
            <>
              <button
                className="button secondary"
                disabled={busy}
                onClick={copyLink}
              >
                <Copy size={15} />
                Copy share link
              </button>
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => onVisibility("private")}
              >
                <Lock size={15} />
                Make private
              </button>
            </>
          ) : (
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => setOpen(true)}
            >
              <Share2 size={15} />
              Share publicly
            </button>
          )}
        </div>
        <details className="sharing-help">
          <summary>About privacy & sharing</summary>
          <p>
            Private recipes are saved for this browser without a sign-in. Keep
            this browser’s site data to retain access, and export a recipe
            backup before clearing it. Sharing includes your recipe and process
            notes. New brew logs and tasting notes stay private even when you
            share a recipe.
          </p>
        </details>
        {status && (
          <p className="sharing-message" role="status">
            {status}
          </p>
        )}
      </div>
      <dialog
        ref={dialog}
        className="share-dialog"
        aria-labelledby="share-title"
        onCancel={(event) => {
          if (busy) event.preventDefault();
          else setOpen(false);
        }}
      >
        <Share2 size={25} />
        <h2 id="share-title">Share this recipe publicly?</h2>
        <p>
          <b>{recipe.name}</b> will appear in the Community recipes collection
          and have a shareable link.
        </p>
        <p>
          Sharing publishes its ingredients, amounts, timings, temperatures,
          description, and all recipe, process, and additive notes. Brew logs
          and tasting notes stay private.
        </p>
        <p className="muted">
          You can make it private again. Copies and exports other people already
          saved may remain.
        </p>
        {error && (
          <p className="alert" role="alert">
            {error}
          </p>
        )}
        <div className="sharing-actions">
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => setOpen(false)}
          >
            Keep private
          </button>
          <button
            className="button primary"
            disabled={busy}
            onClick={async () => {
              if (await onVisibility("public")) setOpen(false);
            }}
          >
            {busy ? "Sharing…" : "Save & share publicly"}
          </button>
        </div>
      </dialog>
    </>
  );
}
