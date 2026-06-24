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
        <li v-for="(f, i) in items" :key="i" class="pp-feeditem" :class="{ 'pp-feeditem--last': i === items.length - 1 }">
          <span class="pp-feeditem__avatar" @click="emitItem(i)">
            <img v-if="avatarUrl(f)" :src="avatarUrl(f)" :alt="authorName(f)" />
            <template v-else>{{ initials(authorName(f)) }}</template>
          </span>
          <div class="pp-feeditem__body">
            <span class="pp-feeditem__head" @click="emitItem(i)">
              <strong>{{ authorName(f) || 'Unknown' }}</strong>
              <span class="pp-muted">{{ timeText(f) }}</span>
            </span>
            <span v-if="actionText(f)" class="pp-feeditem__action">{{ actionText(f) }}</span>
            <p v-if="bodyText(f)">{{ bodyText(f) }}</p>

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
                @click="emitAtt(i, j, att)"
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
      <div v-else class="pp-empty">
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
};

export default {
  props: { content: { type: Object, required: true }, uid: { type: String, required: false } },
  emits: ["trigger-event"],
  data() {
    return { selectedFilter: this.content.activeFilter != null ? this.content.activeFilter : "all" };
  },
  watch: {
    "content.activeFilter"(v) { if (v != null) this.selectedFilter = v; },
  },
  computed: {
    items() { return Array.isArray(this.content.items) ? this.content.items : []; },
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
    actionText(f) { return (f && f.action) || ""; },
    bodyText(f) {
      if (!f) return "";
      return f.text || f.description || f.activity || "";
    },
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
      this.$emit("trigger-event", { name: "filterChange", event: { value } });
    },
    emitItem(i) { this.$emit("trigger-event", { name: "itemClick", event: { index: i } }); },
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
.pp-feeditem__head { display: flex; align-items: center; gap: 8px; margin-bottom: 3px; cursor: pointer; flex-wrap: wrap; }
.pp-feeditem__head strong { color: var(--text); font-size: 13.5px; }
.pp-feeditem__head .pp-muted { font-size: 12px; }
.pp-feeditem__action { display: inline-block; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--accent); margin-bottom: 3px; }
.pp-feeditem__body p { margin: 0; color: var(--text-muted); font-size: 13.5px; overflow-wrap: anywhere; }

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

.pp-empty { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 48px 16px; color: var(--text-subtle); }
.pp-empty .pp-svg { width: 34px; height: 34px; }
.pp-svg { display: block; }
</style>
