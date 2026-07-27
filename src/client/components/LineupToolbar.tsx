import { FORMATIONS } from '../../shared/formations';
import type { LineupSummary } from '../../shared/types';

interface LineupToolbarProps {
  name: string;
  formationId: string;
  filledCount: number;
  slotCount: number;
  dirty: boolean;
  saving: boolean;
  saved: LineupSummary[];
  currentSavedId: string | null;
  onNameChange: (name: string) => void;
  onFormationChange: (formationId: string) => void;
  onSave: () => void;
  onNew: () => void;
  onLoad: (id: string) => void;
  onDelete: (id: string) => void;
}

export function LineupToolbar({
  name,
  formationId,
  filledCount,
  slotCount,
  dirty,
  saving,
  saved,
  currentSavedId,
  onNameChange,
  onFormationChange,
  onSave,
  onNew,
  onLoad,
  onDelete,
}: LineupToolbarProps) {
  return (
    <header className="toolbar">
      <div className="toolbar-row">
        <h1 className="brand">Lineups</h1>

        <label className="field">
          <span className="field-label">Lineup name</span>
          <input
            type="text"
            aria-label="Lineup name"
            placeholder="e.g. Dream XI"
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
          />
        </label>

        <label className="field">
          <span className="field-label">Formation</span>
          <select
            aria-label="Formation"
            value={formationId}
            onChange={(event) => onFormationChange(event.target.value)}
          >
            {FORMATIONS.map((formation) => (
              <option key={formation.id} value={formation.id}>
                {formation.name}
              </option>
            ))}
          </select>
        </label>

        <p className="counter" data-testid="lineup-counter">
          {filledCount} / {slotCount} picked
          {dirty ? <span className="dot" aria-label="Unsaved changes" /> : null}
        </p>

        <div className="toolbar-actions">
          <button type="button" onClick={onNew} className="secondary">
            New
          </button>
          <button
            type="button"
            onClick={onSave}
            className="primary"
            disabled={saving || name.trim().length === 0}
            title={name.trim().length === 0 ? 'Name the lineup before saving' : undefined}
          >
            {saving ? 'Saving…' : currentSavedId ? 'Save' : 'Save lineup'}
          </button>
        </div>
      </div>

      {saved.length > 0 ? (
        <div className="saved" aria-label="Saved lineups">
          <span className="saved-label">Saved:</span>
          <ul className="saved-list">
            {saved.map((lineup) => (
              <li key={lineup.id}>
                <button
                  type="button"
                  className="saved-item"
                  data-current={lineup.id === currentSavedId ? 'true' : 'false'}
                  onClick={() => onLoad(lineup.id)}
                >
                  {lineup.name}
                  <span className="saved-meta">
                    {lineup.formationId} · {lineup.playerCount}/11
                  </span>
                </button>
                <button
                  type="button"
                  className="saved-delete"
                  aria-label={`Delete ${lineup.name}`}
                  onClick={() => onDelete(lineup.id)}
                >
                  <span aria-hidden="true">×</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </header>
  );
}
