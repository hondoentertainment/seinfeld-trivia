import { useState } from "react";
import { getDisplayName, setDisplayName } from "../lib/playerDisplayName";

export function DisplayNameCard() {
  const [name, setName] = useState(() => getDisplayName() ?? "");
  const [saved, setSaved] = useState(false);

  return (
    <div className="card display-name-card">
      <h2 className="card-heading" style={{ marginTop: 0 }}>
        Share as
      </h2>
      <p className="card-muted" style={{ marginTop: "0.35rem" }}>
        Optional nickname included when you copy or share a daily score (stored only on this device).
      </p>
      <label className="display-name-label">
        <span className="visually-hidden">Display name for shares</span>
        <input
          type="text"
          className="browse-search-field"
          maxLength={24}
          placeholder="e.g. Master of your domain"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setSaved(false);
          }}
        />
      </label>
      <button
        type="button"
        className="btn btn-ghost-light"
        style={{ marginTop: "0.5rem" }}
        onClick={() => {
          setDisplayName(name);
          setSaved(true);
        }}
      >
        {saved ? "Saved" : "Save nickname"}
      </button>
    </div>
  );
}
