"use client";
import { useState, useRef, useMemo } from "react";
import { menuData, accordionMenu, pizzaCategoryIds } from "../data/menu";
import MenuItem from "../components/MenuItem";
import DishArt from "../components/DishArt";

// The rail on the left picks one category; the panel on the right shows that
// category and nothing else.
//
// accordionMenu groups categories for display ("Rolls" holds four of them);
// flattening it here gives the rail its groups and its order from one source.
const GROUPS = accordionMenu.map((section) => ({
  id: section.id,
  name: section.name,
  categoryIds: section.subSections
    ? section.subSections.map((s) => s.id)
    : section.categories || [],
}));

const CATEGORIES = GROUPS.flatMap((g) => g.categoryIds)
  .map((id) => menuData.find((c) => c.id === id))
  .filter(Boolean);

const TOTAL_ITEMS = CATEGORIES.reduce((n, c) => n + c.items.length, 0);

export default function MenuPage() {
  const [vegOnly, setVegOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(CATEGORIES[0]?.id);
  const panelRef = useRef(null);

  const search = query.trim().toLowerCase();

  // Each category paired with the items that survive the current filters.
  // Categories left with nothing drop out of the rail entirely.
  const available = useMemo(() => {
    return CATEGORIES.map((category) => {
      let items = vegOnly ? category.items.filter((i) => i.veg) : category.items;
      if (search) {
        items = items.filter(
          (i) =>
            i.name.toLowerCase().includes(search) ||
            category.name.toLowerCase().includes(search)
        );
      }
      return { category, items };
    }).filter((s) => s.items.length > 0);
  }, [vegOnly, search]);

  const availableIds = useMemo(
    () => new Set(available.map((s) => s.category.id)),
    [available]
  );

  // Derived, not stored: if a filter hides whatever was selected, fall back to
  // the first category still showing. Keeping this out of state means the panel
  // can never point at a category the rail no longer offers.
  const openSection =
    available.find((s) => s.category.id === selectedId) || available[0];

  const countFor = (categoryId) =>
    available.find((s) => s.category.id === categoryId).items.length;

  const resultCount = available.reduce((sum, s) => sum + s.items.length, 0);

  const selectCategory = (categoryId) => {
    setSelectedId(categoryId);
    // On mobile the rail sits above the panel, so bring the panel into view.
    if (typeof window !== "undefined" && window.innerWidth <= 900) {
      requestAnimationFrame(() => {
        panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  };

  const clearFilters = () => {
    setQuery("");
    setVegOnly(false);
  };

  return (
    <div className="page menu-page">
      <header className="page-head">
        <span className="section-eyebrow">Freshly made, all day</span>
        <h2>Our Menu</h2>
        <p>
          {TOTAL_ITEMS} dishes across {GROUPS.length} sections
        </p>
      </header>

      {/* Search and veg filter change what the rail offers, so they sit above it */}
      <div className="menu-toolbar">
        <div className="menu-search">
          <span className="menu-search-icon" aria-hidden="true">🔍</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for a dish…"
            aria-label="Search the menu"
          />
          {query && (
            <button className="menu-search-clear" onClick={() => setQuery("")} aria-label="Clear search">
              ✕
            </button>
          )}
        </div>
        <button
          className={`veg-toggle ${vegOnly ? "active" : ""}`}
          onClick={() => setVegOnly(!vegOnly)}
          aria-pressed={vegOnly}
        >
          <span className="veg-badge" aria-hidden="true"></span>
          Veg only
        </button>
      </div>

      {(search || vegOnly) && available.length > 0 && (
        <p className="menu-result-count">
          {resultCount} {resultCount === 1 ? "dish" : "dishes"}
          {search ? ` matching “${query.trim()}”` : " on the veg menu"} in{" "}
          {available.length} {available.length === 1 ? "section" : "sections"} — pick one on the left
        </p>
      )}

      {available.length === 0 ? (
        <div className="menu-empty">
          <div className="menu-empty-icon" aria-hidden="true">🍽️</div>
          <h3>Nothing matches that</h3>
          <p>Try a different spelling, or clear the filters to see the full menu.</p>
          <button className="btn-secondary" onClick={clearFilters}>
            Clear filters
          </button>
        </div>
      ) : (
        <div className="menu-shell">
          {/* Category rail — sidebar on desktop, scrolling chips on mobile */}
          <nav className="menu-rail" aria-label="Menu categories">
            <div className="menu-rail-inner">
              {GROUPS.map((group) => {
                const groupCategories = group.categoryIds
                  .filter((id) => availableIds.has(id))
                  .map((id) => CATEGORIES.find((c) => c.id === id));
                if (groupCategories.length === 0) return null;

                // A group holding one category needs no sub-list — the group
                // name and the category name say the same thing.
                if (groupCategories.length === 1) {
                  const category = groupCategories[0];
                  const isOpen = openSection.category.id === category.id;
                  return (
                    <button
                      key={group.id}
                      className={`rail-link ${isOpen ? "active" : ""}`}
                      onClick={() => selectCategory(category.id)}
                      aria-expanded={isOpen}
                      aria-controls="menu-panel"
                    >
                      <DishArt categoryId={category.id} size={26} />
                      <span className="rail-link-name">{group.name}</span>
                      <span className="rail-link-count">{countFor(category.id)}</span>
                    </button>
                  );
                }

                return (
                  <div className="rail-group" key={group.id}>
                    <span className="rail-group-name">{group.name}</span>
                    {groupCategories.map((category) => {
                      const isOpen = openSection.category.id === category.id;
                      return (
                        <button
                          key={category.id}
                          className={`rail-link rail-link-sub ${isOpen ? "active" : ""}`}
                          onClick={() => selectCategory(category.id)}
                          aria-expanded={isOpen}
                          aria-controls="menu-panel"
                        >
                          <DishArt categoryId={category.id} size={26} />
                          <span className="rail-link-name">{category.name}</span>
                          <span className="rail-link-count">{countFor(category.id)}</span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </nav>

          {/* Only the selected category is rendered */}
          <div className="menu-sections" id="menu-panel" ref={panelRef}>
            <section
              key={openSection.category.id}
              className="menu-section is-open"
              aria-labelledby="open-section-heading"
            >
              <div className="menu-section-head">
                <DishArt categoryId={openSection.category.id} size={44} />
                <div className="menu-section-title">
                  <h3 id="open-section-heading">{openSection.category.name}</h3>
                  {openSection.category.description && (
                    <p>{openSection.category.description}</p>
                  )}
                </div>
                <span className="item-count">{openSection.items.length} items</span>
              </div>

              <div className="menu-grid">
                {openSection.items.map((item) => (
                  <MenuItem
                    key={item.id}
                    item={item}
                    categoryType={openSection.category.type}
                    labels={openSection.category.labels}
                    isPizza={pizzaCategoryIds.includes(openSection.category.id)}
                    addonEligible={!!openSection.category.addonEligible}
                  />
                ))}
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
