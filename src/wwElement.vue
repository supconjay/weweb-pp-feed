<template>
  <div class="pp-root" :class="themeClass" :style="rootStyle">
    <div class="pp-card">
      <div class="pp-card__header"><h2 class="pp-card__heading pp-card__heading--lg">{{ content.title }}</h2></div>
      <div v-if="content.showFilters !== false && filters.length" class="pp-filters" role="tablist">
        <button
          v-for="(flt, k) in filters"
          :key="k"
          class="pp-filter"
          :class="{ 'pp-filter--active': selectedFilter === flt.value }"
          type="button"
          @click="selectFilter(flt.value)"
        >{{ flt.label }}</button>
      </div>
      <ul v-if="items.length" class="pp-feed">
        <li v-for="(f, i) in pagedItems" :key="pageOffset + i" class="pp-feeditem" :class="{ 'pp-feeditem--last': i === pagedItems.length - 1 }">
          <span class="pp-feeditem__avatar" @click="emitItem(pageOffset + i)">
            <img v-if="avatarUrl(f)" :src="avatarUrl(f)" :alt="authorName(f)" />
            <template v-else>{{ initials(authorName(f)) }}</template>
          </span>
          <div class="pp-feeditem__body">
            <div class="pp-feeditem__top">
              <span class="pp-feeditem__head" @click="emitItem(pageOffset + i)">
                <strong>{{ authorName(f) || 'Unknown' }}</strong>
                <span v-if="activityLabel(f)" class="pp-feeditem__activity">{{ activityLabel(f) }}</span>
                <span class="pp-muted">{{ timeText(f) }}</span>
              </span>
              <button v-if="content.showDelete !== false" class="pp-feeditem__del" type="button" aria-label="Delete" @click.stop="emitDelete(pageOffset + i, f)">
                <svg class="pp-svg" v-bind="svgAttrs"><path :d="ic('trash')"></path></svg>
              </button>
            </div>
            <template v-if="bodyText(f)">
              <div v-if="content.renderHtml !== false" class="pp-feeditem__text" v-html="bodyText(f)"></div>
              <p v-else class="pp-feeditem__text">{{ stripHtml(bodyText(f)) }}</p>
            </template>

            <div v-if="content.showAttachments !== false && attachmentsOf(f).length" class="pp-atts">
              <a
                v-for="(att, j) in attachmentsOf(f)"
                :key="j"
                class="pp-att"
                :class="isImage(att) ? 'pp-att--img' : 'pp-att--file'"
                :href="att.url || undefined"
                target="_blank"
                rel="noopener noreferrer"
                :title="attName(att)"
                @click="emitAtt(pageOffset + i, j, att)"
              >
                <template v-if="isImage(att)">
                  <img v-if="attThumb(att)" :src="attThumb(att)" :alt="attName(att)" />
                  <svg v-else class="pp-svg" v-bind="svgAttrs"><path :d="ic('image')"></path></svg>
                </template>
                <template v-else>
                  <svg class="pp-svg" v-bind="svgAttrs"><path :d="ic('file')"></path></svg>
                  <span class="pp-att__name">{{ attName(att) }}</span>
                </template>
              </a>
            </div>
          </div>
        </li>
      </ul>

      <div v-if="paginationActive" class="pp-pager">
        <button class="pp-pager__btn" type="button" :disabled="page <= 1" aria-label="Previous page" @click="goPage(page - 1)">
          <svg class="pp-svg" v-bind="svgAttrs"><path :d="ic('chevron-left')"></path></svg>
        </button>
        <span class="pp-pager__info">Page {{ page }} of {{ totalPages }}</span>
        <button class="pp-pager__btn" type="button" :disabled="page >= totalPages" aria-label="Next page" @click="goPage(page + 1)">
          <svg class="pp-svg" v-bind="svgAttrs"><path :d="ic('chevron-right')"></path></svg>
        </button>
      </div>

      <div v-if="!items.length" class="pp-empty">
        <svg class="pp-svg" v-bind="svgAttrs"><path :d="ic('rss')"></path></svg>
        <span>No activity yet</span>
      </div>
    </div>
  </div>
</template>

<script>
const ICONS = {
  rss: "M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16M5 19a1 1 0 1 0 0-2 1 1 0 0 0 0 2z",
  file: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6",
  image: "M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5zM8.5 11a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM21 15l-5-5L5 21",
  trash: "M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2",
  "chevron-left": "M15 18l-6-6 6-6",
  "chevron-right": "M9 18l6-6-6-6",
};

export default {
  props: { content: { type: Object, required: true }, uid: { type: String, required: false } },
  emits: ["trigger-event"],
  data() {
    return {
      selectedFilter: this.content.activeFilter != null ? this.content.activeFilter : "all",
      page: 1,
    };
  },
  watch: {
    "content.activeFilter"(v) { if (v != null) this.selectedFilter = v; },
    itemsLength(n) {
      const tp = Math.max(1, Math.ceil(n / this.pageSize));
      if (this.page > tp) this.page = tp;
    },
  },
  computed: {
    pageSize() { const n = Number(this.content.pageSize); return n > 0 ? Math.floor(n) : 5; },
    itemsLength() { return this.items.length; },
    totalPages() { return Math.max(1, Math.ceil(this.items.length / this.pageSize)); },
    paginationActive() { return this.content.paginate !== false && this.totalPages > 1; },
    pageOffset() { return this.content.paginate !== false ? (this.page - 1) * this.pageSize : 0; },
    pagedItems() {
      if (this.content.paginate === false) return this.items;
      return this.items.slice(this.pageOffset, this.pageOffset + this.pageSize);
    },
    items() {
      const raw = this.content.items;
      if (Array.isArray(raw)) return raw;
      // Accept a full WeWeb collection object: { data: [...], total, ... }
      if (raw && typeof raw === "object") {
        if (Array.isArray(raw.data)) return raw.data;
        if (Array.isArray(raw.items)) return raw.items;
      }
      return [];
    },
    filters() { return Array.isArray(this.content.filters) ? this.content.filters : []; },
    svgAttrs() {
      return { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" };
    },
    themeClass() {
      const m = this.content.darkMode || "auto";
      return { "pp-auto": m === "auto", "pp-dark": m === "dark", "pp-light": m === "light" };
    },
    rootStyle() {
      return {
        "--pp-primary": this.content.primaryColor || "#10b981",
        "--pp-accent": this.content.accentColor || "#6366f1",
        "--pp-radius": (this.content.radius != null ? this.content.radius : 16) + "px",
      };
    },
  },
  methods: {
    ic(name) { return ICONS[name] || ""; },
    // ---- field auto-resolution (activity_feed shape OR simple shape) ----
    authorName(f) {
      if (!f) return "";
      return f.author || (f.user_id && f.user_id.name) || (f.user && f.user.name) || f.name || "";
    },
    avatarUrl(f) {
      if (!f) return "";
      return f.avatar || (f.user_id && f.user_id.headshot) || (f.user && f.user.headshot) || f.headshot || "";
    },
    timeText(f) {
      if (!f) return "";
      if (f.time) return f.time;
      const raw = f.created_at || f.createdAt || f.date;
      if (!raw) return "";
      const d = new Date(raw);
      if (isNaN(d)) return String(raw);
      return d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
    },
    activityLabel(f) { return (f && (f.activity || f.action)) || ""; },
    bodyText(f) {
      if (!f) return "";
      return f.text || f.description || "";
    },
    stripHtml(s) { return String(s == null ? "" : s).replace(/<[^>]*>/g, "").trim(); },
    attachmentsOf(f) { return f && Array.isArray(f.attachments) ? f.attachments : []; },
    isImage(att) {
      if (!att) return false;
      const ct = (att.content_type || att.contentType || att.type || "").toLowerCase();
      if (ct) return ct.indexOf("image/") === 0;
      const u = (att.url || att || "").toString().toLowerCase();
      return /\.(png|jpe?g|gif|webp|svg|bmp)(\?|$)/.test(u);
    },
    attThumb(att) {
      if (!att) return "";
      return att.thumbnail_url || att.thumbnailUrl || att.url || "";
    },
    attName(att) {
      if (!att) return "File";
      if (att.name || att.filename) return att.name || att.filename;
      const ct = att.content_type || att.contentType || att.type || "";
      const sub = ct.split("/")[1];
      if (sub) return sub.toUpperCase();
      const u = (att.url || "").toString().split("?")[0];
      const base = u.substring(u.lastIndexOf("/") + 1);
      return base || "File";
    },
    initials(name) { return (name || "").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase(); },
    selectFilter(value) {
      this.selectedFilter = value;
      this.page = 1;
      this.$emit("trigger-event", { name: "filterChange", event: { value } });
    },
    goPage(p) {
      const next = Math.max(1, Math.min(this.totalPages, p));
      if (next === this.page) return;
      this.page = next;
      this.$emit("trigger-event", { name: "pageChange", event: { page: next } });
    },
    emitItem(i) { this.$emit("trigger-event", { name: "itemClick", event: { index: i } }); },
    emitDelete(i, f) { this.$emit("trigger-event", { name: "delete", event: { index: i, id: (f && f.id) != null ? f.id : "" } }); },
    emitAtt(i, j, att) {
      this.$emit("trigger-event", { name: "attachmentClick", event: { feedIndex: i, attachmentIndex: j, url: (att && att.url) || "" } });
    },
  },
};
</script>

<style lang="scss" scoped>
.pp-root {
  --surface: #ffffff; --surface-2: #f7f9fc; --surface-3: #eef2f7; --border: #e4e9f0; --border-strong: #d4dbe6;
  --text: #1f2a37; --text-muted: #64748b; --text-subtle: #94a3b8;
  --shadow: 0 1px 2px rgba(16, 24, 40, 0.04), 0 8px 24px rgba(16, 24, 40, 0.06);
  --shadow-sm: 0 1px 2px rgba(16, 24, 40, 0.06);
  --danger: #ef4444; --info: #3b82f6;
  --accent: var(--pp-accent, #6366f1); --primary: var(--pp-primary, #10b981); --radius: var(--pp-radius, 16px);
  box-sizing: border-box; width: 100%; max-width: 100%; color: var(--text);
  font-family: "Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  -webkit-font-smoothing: antialiased; font-size: 14px; line-height: 1.45;
}
.pp-root *, .pp-root *::before, .pp-root *::after { box-sizing: border-box; }
@mixin dark {
  --surface: #161f30; --surface-2: #1b2638; --surface-3: #202c40; --border: #28344a; --border-strong: #34425c;
  --text: #e8eef7; --text-muted: #94a3b8; --text-subtle: #64748b;
  --shadow: 0 1px 2px rgba(0, 0, 0, 0.4), 0 12px 28px rgba(0, 0, 0, 0.35);
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
}
.pp-root.pp-dark { @include dark; }
@media (prefers-color-scheme: dark) { .pp-root.pp-auto { @include dark; } }

.pp-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); padding: clamp(16px, 2.4vw, 24px); }
.pp-card__header { margin-bottom: 16px; }

.pp-filters { display: inline-flex; gap: 4px; padding: 4px; background: var(--surface-2); border: 1px solid var(--border); border-radius: 12px; margin-bottom: 18px; flex-wrap: wrap; max-width: 100%; }
.pp-filter { border: none; background: transparent; color: var(--text-muted); padding: 8px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; white-space: nowrap; transition: background .15s, color .15s; }
.pp-filter:hover { color: var(--text); }
.pp-filter--active { background: var(--surface); color: var(--primary); box-shadow: var(--shadow-sm); }
.pp-card__heading { margin: 0; font-size: 18px; font-weight: 700; color: var(--text); }
.pp-muted { color: var(--text-muted); }

.pp-feed { list-style: none; margin: 0; padding: 0; }
.pp-feeditem { display: flex; gap: 14px; padding-bottom: 22px; position: relative; }
.pp-feeditem::before { content: ""; position: absolute; left: 19px; top: 44px; bottom: 0; width: 2px; background: var(--border); }
.pp-feeditem--last::before { display: none; }
.pp-feeditem__avatar { flex: none; display: grid; place-items: center; width: 40px; height: 40px; border-radius: 50%; overflow: hidden; background: color-mix(in srgb, var(--accent) 16%, transparent); color: var(--accent); font-weight: 700; font-size: 13px; z-index: 1; cursor: pointer; }
.pp-feeditem__avatar img { width: 100%; height: 100%; object-fit: cover; }
.pp-feeditem__body { flex: 1; min-width: 0; }
.pp-feeditem__top { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
.pp-feeditem__del { flex: none; display: grid; place-items: center; width: 28px; height: 28px; border: none; background: transparent; border-radius: 8px; color: var(--text-subtle); cursor: pointer; transition: background .15s, color .15s; }
.pp-feeditem__del:hover { background: color-mix(in srgb, var(--danger) 12%, transparent); color: var(--danger); }
.pp-feeditem__del .pp-svg { width: 16px; height: 16px; }
.pp-feeditem__head { display: flex; align-items: center; gap: 8px; margin-bottom: 3px; cursor: pointer; flex-wrap: wrap; min-width: 0; }
.pp-feeditem__head strong { color: var(--text); font-size: 13.5px; }
.pp-feeditem__head .pp-muted { font-size: 12px; }
.pp-feeditem__activity { color: var(--text); font-weight: 600; font-size: 13.5px; }
.pp-feeditem__text { margin: 0; color: var(--text-muted); font-size: 13.5px; overflow-wrap: anywhere; }
.pp-feeditem__text :deep(p) { margin: 0; }
.pp-feeditem__text :deep(p + p) { margin-top: 6px; }
.pp-feeditem__text :deep(a) { color: var(--info); }
.pp-feeditem__text :deep(ul), .pp-feeditem__text :deep(ol) { margin: 4px 0; padding-left: 18px; }
.pp-feeditem__text :deep(img) { max-width: 100%; border-radius: 8px; }

.pp-atts { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
.pp-att { text-decoration: none; cursor: pointer; }
.pp-att--img { display: grid; place-items: center; width: 56px; height: 56px; border-radius: 9px; overflow: hidden; border: 1px solid var(--border); background: var(--surface-2); color: var(--text-subtle); transition: border-color .15s, transform .12s; }
.pp-att--img:hover { border-color: var(--border-strong); transform: translateY(-1px); }
.pp-att--img img { width: 100%; height: 100%; object-fit: cover; }
.pp-att--img .pp-svg { width: 22px; height: 22px; }
.pp-att--file { display: inline-flex; align-items: center; gap: 7px; max-width: 100%; min-width: 0; padding: 8px 11px; border-radius: 9px; border: 1px solid var(--border); background: var(--surface-2); color: var(--text-muted); font-size: 12.5px; font-weight: 600; transition: border-color .15s, color .15s; }
.pp-att--file:hover { border-color: var(--border-strong); color: var(--text); }
.pp-att--file .pp-svg { width: 15px; height: 15px; flex: none; color: var(--danger); }
.pp-att__name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.pp-pager { display: flex; align-items: center; justify-content: center; gap: 14px; padding-top: 8px; margin-top: 2px; border-top: 1px solid var(--border); }
.pp-pager__btn { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 9px; border: 1px solid var(--border); background: var(--surface); color: var(--text-muted); cursor: pointer; transition: background .15s, color .15s, border-color .15s; }
.pp-pager__btn:hover:not(:disabled) { background: var(--surface-3); color: var(--text); border-color: var(--border-strong); }
.pp-pager__btn:disabled { opacity: .4; cursor: default; }
.pp-pager__btn .pp-svg { width: 16px; height: 16px; }
.pp-pager__info { font-size: 13px; font-weight: 600; color: var(--text-muted); min-width: 96px; text-align: center; }

.pp-empty { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 48px 16px; color: var(--text-subtle); }
.pp-empty .pp-svg { width: 34px; height: 34px; }
.pp-svg { display: block; }
</style>
