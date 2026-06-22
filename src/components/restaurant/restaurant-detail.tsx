import { useState } from "react";
import { Check, Pencil, Plus } from "lucide-react";
import { updateEntry, saveRatings, removeRestaurantFromList, attachRestaurantToList } from "@/app/actions";
import { formatCityState } from "@/lib/address";
import { NotePreview, NotesEditField } from "./notes";
import { RatingSummary, AttributePreview } from "./rating-display";
import { RatingInput } from "./rating-input";
import { CheckInCard, CheckInForm } from "./checkin";
import { RestaurantPhotos } from "./restaurant-photos";
import { RATING_ICON_MAP, RATING_PRESETS, type RatingDefinition, repeatedIcon } from "./rating-common";
import { useHaptics } from "@/hooks/use-haptics";
import type { AppState, Restaurant } from "@/lib/types";

function googleMapsUrl(r: Restaurant) {
  const query = [r.name, r.address].filter(Boolean).join(" ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function yelpUrl(r: Restaurant) {
  return `https://www.yelp.com/search?find_desc=${encodeURIComponent(r.name)}&find_loc=${encodeURIComponent(r.address || [r.lat, r.lon].filter((v) => v !== null).join(","))}`;
}

export function RestaurantDetail({
  canWrite,
  entry,
  activeListId,
  lists,
  globalRatingDefinitions,
  ratingDefinitions,
  initialEdit,
}: {
  canWrite: boolean;
  entry: Restaurant;
  activeListId: number | null;
  lists: AppState["lists"];
  globalRatingDefinitions: RatingDefinition[];
  ratingDefinitions: RatingDefinition[];
  initialEdit: boolean;
}) {
  const haptics = useHaptics();
  const [entryMode, setEntryMode] = useState<"edit" | "preview">(initialEdit && canWrite ? "edit" : "preview");
  const [standingNotes, setStandingNotes] = useState(entry.standingNotes ?? "");
  const [favoriteItems, setFavoriteItems] = useState(entry.favoriteItems ?? "");
  const [orderingTips, setOrderingTips] = useState(entry.orderingTips ?? "");

  const resetEntryEdit = () => {
    setStandingNotes(entry.standingNotes ?? "");
    setFavoriteItems(entry.favoriteItems ?? "");
    setOrderingTips(entry.orderingTips ?? "");
    setEntryMode("preview");
  };

  const globalSummaryDefinitions = globalRatingDefinitions.filter((d) => d.active);

  const ratingGroups = [
    { list: { id: 0, name: "Global attributes" }, definitions: globalRatingDefinitions },
    ...entry.ratingGroups,
  ];

  return (
    <div className="detail-content">
      <div className="detail-head">
        <div className="detail-title-group">
          <h3>{entry.name}</h3>
          <span className="detail-location">{formatCityState(entry.address)}</span>
          <RatingSummary entry={entry} definitions={globalSummaryDefinitions} />
        </div>
        <div className="detail-actions">
          {canWrite && entryMode === "preview" ? (
            <button type="button" className="ghost-button icon-button" onClick={() => setEntryMode("edit")} aria-label="Edit notes and ratings">
              <Pencil size={16} />
            </button>
          ) : null}
          <a href={entry.googleMapsUrl || googleMapsUrl(entry)} target="_blank" rel="noreferrer" className="icon-link" aria-label="Open in Google Maps">
            <svg viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg">
              <path d="M19.527 4.799c1.212 2.608.937 5.678-.405 8.173-1.101 2.047-2.744 3.74-4.098 5.614-.619.858-1.244 1.75-1.669 2.727-.141.325-.263.658-.383.992-.121.333-.224.673-.34 1.008-.109.314-.236.684-.627.687h-.007c-.466-.001-.579-.53-.695-.887-.284-.874-.581-1.713-1.019-2.525-.51-.944-1.145-1.817-1.79-2.671L19.527 4.799zM8.545 7.705l-3.959 4.707c.724 1.54 1.821 2.863 2.871 4.18.247.31.494.622.737.936l4.984-5.925-.029.01c-1.741.601-3.691-.291-4.392-1.987a3.377 3.377 0 0 1-.209-.716c-.063-.437-.077-.761-.004-1.198l.001-.007zM5.492 3.149l-.003.004c-1.947 2.466-2.281 5.88-1.117 8.77l4.785-5.689-.058-.05-3.607-3.035zM14.661.436l-3.838 4.563a.295.295 0 0 1 .027-.01c1.6-.551 3.403.15 4.22 1.626.176.319.323.683.377 1.045.068.446.085.773.012 1.22l-.003.016 3.836-4.561A8.382 8.382 0 0 0 14.67.439l-.009-.003zM9.466 5.868L14.162.285l-.047-.012A8.31 8.31 0 0 0 11.986 0a8.439 8.439 0 0 0-6.169 2.766l-.016.018 3.665 3.084z" fill="#34A853"/>
            </svg>
          </a>
          <a href={entry.yelpUrl || yelpUrl(entry)} target="_blank" rel="noreferrer" className="icon-link" aria-label="Open in Yelp">
            <svg viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg">
              <path d="m7.6885 15.1415-3.6715.8483c-.3769.0871-.755.183-1.1452.155-.2611-.0188-.5122-.0414-.7606-.213a1.179 1.179 0 0 1-.331-.3594c-.3486-.5519-.3656-1.3661-.3697-2.0004a6.2874 6.2874 0 0 1 .3314-2.0642 1.857 1.857 0 0 1 .1073-.2474 2.3426 2.3426 0 0 1 .1255-.2165 2.4572 2.4572 0 0 1 .1563-.1975 1.1736 1.1736 0 0 1 .399-.2831 1.082 1.082 0 0 1 .4592-.0837c.2355.0016.5139.052.91.1734.0555.0191.1237.0382.1856.0572.3277.1013.7048.2404 1.1499.3987.6863.2404 1.3663.487 2.0463.7397l1.2117.4423c.2217.0807.4363.18.6412.297.174.0984.3273.2298.4512.387a1.217 1.217 0 0 1 .192.4309 1.2205 1.2205 0 0 1-.872 1.4522c-.0468.0151-.0852.0239-.1085.0293l-1.105.2553-.0031-.001zM18.8208 7.565a1.8506 1.8506 0 0 0-.2042-.1754 2.4082 2.4082 0 0 0-.2077-.1394 2.3607 2.3607 0 0 0-.2269-.109 1.1705 1.1705 0 0 0-.482-.0796 1.0862 1.0862 0 0 0-.4498.1263c-.2107.1048-.4388.2732-.742.5551-.042.0417-.0947.0886-.142.133-.2502.2351-.5286.5252-.8599.863a114.6363 114.6363 0 0 0-1.5166 1.5629l-.8962.9293a4.1897 4.1897 0 0 0-.4466.5483 1.541 1.541 0 0 0-.2364.5459 1.2199 1.2199 0 0 0 .0107.4518l.0046.02a1.218 1.218 0 0 0 1.4184.923 1.162 1.162 0 0 0 .1105-.0213l4.7781-1.104c.3766-.087.7587-.1667 1.097-.3631.2269-.1316.4428-.262.5909-.5252a1.1793 1.1793 0 0 0 .1405-.4683c.0733-.6512-.2668-1.3908-.5403-1.963a6.2792 6.2792 0 0 0-1.2001-1.7103zM8.9703.0754a8.6724 8.6724 0 0 0-.83.1564c-.2754.066-.548.1383-.8146.2236-.868.2844-2.0884.8063-2.295 1.8065-.1165.5655.1595 1.1439.3737 1.66.2595.6254.614 1.1889.9373 1.7777.8543 1.5545 1.7245 3.0993 2.5922 4.6457.259.4617.5416 1.0464 1.043 1.2856a1.058 1.058 0 0 0 .1013.0383c.2248.0851.4699.1016.7041.0471a4.3015 4.3015 0 0 0 .0418-.0097 1.2136 1.2136 0 0 0 .5658-.3397 1.1033 1.1033 0 0 0 .079-.0822c.3463-.435.3454-1.0833.3764-1.6134.1042-1.771.2139-3.5423.3009-5.3142.0332-.6712.1055-1.3333.0655-2.0096-.0328-.5579-.0368-1.1984-.3891-1.6563-.6218-.8073-1.9476-.741-2.8523-.6158zm2.084 15.9505a1.1053 1.1053 0 0 0-1.2306-.4145 1.1398 1.1398 0 0 0-.1526.06..." fill="#d32323"/>
            </svg>
          </a>
        </div>
      </div>

      {canWrite && entryMode === "edit" ? (
        <form
          action={async (fd) => { await updateEntry(fd); await saveRatings(fd); haptics.success(); setEntryMode("preview"); }}
          className="entry-edit-form"
        >
          <input type="hidden" name="restaurantId" value={entry.id} />
          <div className="section-head"><h4>Edit notes and ratings</h4></div>
          <div className="entry-edit-grid">
            <section className="entry-edit-section">
              <h5>Notes</h5>
              <NotesEditField title="Order" name="standingNotes" value={standingNotes} onChange={setStandingNotes} placeholder="What to order" />
              <NotesEditField title="Skip" name="favoriteItems" value={favoriteItems} onChange={setFavoriteItems} placeholder="What to avoid" />
              <NotesEditField title="People" name="orderingTips" value={orderingTips} onChange={setOrderingTips} placeholder="Who likes this place or what group it fits" />
            </section>
            <section className="entry-edit-section">
              <h5>Ratings</h5>
              <RatingFields entry={entry} groups={ratingGroups} />
            </section>
          </div>
          <div className="form-actions">
            <button>Save entry</button>
            <button type="button" className="ghost-button" onClick={resetEntryEdit}>Cancel</button>
          </div>
        </form>
      ) : (
        <>
          <section className="notes-panel">
            <div className="section-head"><h4>Notes</h4></div>
            <NotePreview standingNotes={standingNotes} favoriteItems={favoriteItems} orderingTips={orderingTips} />
          </section>
          <section className="notes-panel">
            <div className="section-head"><h4>Attributes</h4></div>
            <AttributePreview entry={entry} groups={ratingGroups} />
          </section>
          <RestaurantPhotos canWrite={canWrite} entry={entry} />
        </>
      )}

      {canWrite ? (
        <section className="settings-section restaurant-lists-section">
          <div className="section-head"><h4>Lists</h4></div>
          {lists.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>No lists yet.</p>
          ) : (
            <div className="list-toggle-grid">
              {lists.map((list) => {
                const inList = entry.memberships.some((m) => m.id === list.id);
                return (
                  <form
                    key={list.id}
                    action={inList ? removeRestaurantFromList : attachRestaurantToList}
                    className="list-toggle-form"
                  >
                    <input type="hidden" name="restaurantId" value={entry.id} />
                    <input type="hidden" name="listId" value={list.id} />
                    <button type="submit" className={`list-toggle-btn${inList ? " active" : ""}`} aria-pressed={inList}>
                      <span className="list-toggle-check" aria-hidden="true">
                        {inList ? <Check size={13} /> : <Plus size={13} />}
                      </span>
                      <span className="list-toggle-name">{list.name}</span>
                    </button>
                  </form>
                );
              })}
            </div>
          )}
        </section>
      ) : null}

      <section className="checkin-box">
        <h4>Check-ins</h4>
        {entry.latestCheckIn ? (
          <div className="checkin-list">
            {entry.checkIns.map((c) => (<CheckInCard key={c.id} canWrite={canWrite} checkIn={c} />))}
          </div>
        ) : (
          <p className="muted">No check-ins yet.</p>
        )}
        {canWrite ? <CheckInForm entry={entry} /> : null}
      </section>
    </div>
  );
}


function RatingFields({ entry, groups }: { entry: Restaurant; groups: Restaurant["ratingGroups"] }) {
  const activeGroups = groups
    .map((g) => ({ ...g, definitions: g.definitions.filter((d) => d.active) }))
    .filter((g) => g.definitions.length);
  if (!activeGroups.length) return <p className="muted">No rating fields enabled.</p>;
  return (
    <div className="rating-grid">
      {activeGroups.map((g) => (
        <section className={`rating-field-card ${g.list.id === 0 ? "rating-field-global" : ""}`} key={g.list.id}>
          <div className="rating-field-card-head">
            <span>{g.list.id === 0 ? "Global attributes" : g.list.name}</span>
            <small>{g.definitions.length} fields</small>
          </div>
          <div className="rating-field-list">
            {g.definitions.map((d) => {
              const value = entry.ratings.find((r) => r.definitionId === d.id)?.value ?? "";
              return (
                <label className="rating-field-row" key={d.id}>
                  <small>{d.name}</small>
                  <RatingInput definition={d} value={value} disabled={false} />
                </label>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
