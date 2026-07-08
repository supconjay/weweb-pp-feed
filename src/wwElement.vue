<template>
  <div class="pp-root" :class="themeClass" :style="rootStyle">
    <div class="pp-card">
      <div class="pp-card__header"><h2 class="pp-card__heading pp-card__heading--lg">{{ content.title }}</h2></div>

      <!-- composer -->
      <div v-if="content.showComposer !== false" class="pp-composer" :class="{ 'pp-composer--active': composerActive }">
        <span class="pp-composer__avatar">
          <img v-if="currentAvatar" :src="currentAvatar" :alt="content.currentUserName || 'You'" />
          <template v-else>{{ initials(content.currentUserName) || 'You' }}</template>
        </span>
        <div class="pp-composer__main">
          <div class="pp-composer__inputwrap">
            <div
              ref="composer"
              class="pp-composer__input"
              contenteditable="true"
              role="textbox"
              :data-placeholder="content.composerPlaceholder || 'Write a note…  type @ to mention someone'"
              @input="onComposerInput"
              @keydown="onComposerKeydown"
              @keyup="onComposerKeyup"
              @click="detectMention"
              @focus="onComposerFocus"
              @paste="onPaste"
            ></div>

            <!-- task widget (appears once someone is mentioned) -->
            <div v-if="showTaskWidget" class="pp-taskwidget" @mousedown.prevent="emitAddTask" title="Create a task from this note">
              <svg class="pp-svg" v-bind="svgAttrs"><path :d="ic('check-square')"></path></svg>
              <span>{{ content.taskWidgetLabel || 'Add task?' }}</span>
            </div>

            <!-- @mention menu -->
            <div v-if="mentionOpen" class="pp-mentionmenu">
              <button
                v-for="(u, mi) in filteredMentionUsers" :key="u.id != null && u.id !== '' ? u.id : mi" type="button"
                class="pp-mentionitem" :class="{ 'pp-mentionitem--active': mi === mentionIndex }"
                @mousedown.prevent="insertMention(u)" @mouseenter="mentionIndex = mi"
              >
                <span class="pp-mentionitem__avatar">
                  <img v-if="u.avatar" :src="u.avatar" :alt="u.name" />
                  <template v-else>{{ initials(u.name) }}</template>
                </span>
                <span class="pp-mentionitem__name">{{ u.name }}</span>
                <span v-if="u.subtitle" class="pp-mentionitem__sub">{{ u.subtitle }}</span>
              </button>
              <div v-if="!filteredMentionUsers.length" class="pp-mentionmenu__empty">No people found</div>
            </div>
          </div>

          <!-- expanded footer: attachments + actions -->
          <div v-if="composerActive" class="pp-composer__foot">
            <div
              v-if="content.allowAttachments !== false"
              class="pp-drop" :class="{ 'pp-drop--over': dragActive }"
              @dragover.prevent="dragActive = true" @dragleave.prevent="dragActive = false" @drop.prevent="onDrop"
              @click="triggerFile"
            >
              <svg class="pp-svg" v-bind="svgAttrs"><path :d="ic('file-plus')"></path></svg>
              <span>{{ content.attachHint || 'Drop your attachment here or click to browse' }}</span>
              <input ref="file" type="file" multiple class="pp-drop__input" @change="onFileInput" />
            </div>

            <div v-if="attachments.length" class="pp-attpreview">
              <div v-for="(a, ai) in attachments" :key="ai" class="pp-attchip" :class="a.isImage ? 'pp-attchip--img' : 'pp-attchip--file'">
                <img v-if="a.isImage && a.url" :src="a.url" :alt="a.name" />
                <template v-else>
                  <svg class="pp-svg" v-bind="svgAttrs"><path :d="ic('file')"></path></svg>
                  <span class="pp-attchip__name">{{ a.name }}</span>
                </template>
                <button type="button" class="pp-attchip__x" @click.stop="removeAttachment(ai)" aria-label="Remove attachment">
                  <svg class="pp-svg" v-bind="svgAttrs"><path :d="ic('x')"></path></svg>
                </button>
              </div>
            </div>

            <div class="pp-composer__actions">
              <button v-if="content.allowAttachments !== false" type="button" class="pp-composer__tool" @click="triggerFile" title="Attach a file">
                <svg class="pp-svg" v-bind="svgAttrs"><path :d="ic('paperclip')"></path></svg>
              </button>
              <div class="pp-composer__spacer"></div>
              <button type="button" class="pp-btn pp-btn--ghost" @click="cancelComposer">Cancel</button>
              <button type="button" class="pp-btn pp-btn--primary" :disabled="composerEmpty && !attachments.length" @click="submitNote">
                <svg class="pp-svg" v-bind="svgAttrs"><path :d="ic('send')"></path></svg> {{ content.submitLabel || 'Post Note' }}
              </button>
            </div>
          </div>
        </div>
      </div>

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
              <button v-if="canDelete(f)" class="pp-feeditem__del" type="button" aria-label="Delete" @click.stop="emitDelete(pageOffset + i, f)">
                <svg class="pp-svg" v-bind="svgAttrs"><path :d="ic('trash')"></path></svg>
              </button>
            </div>
            <template v-if="bodyText(f)">
              <div v-if="content.renderHtml !== false" class="pp-feeditem__text" v-html="bodyText(f)"></div>
              <p v-else class="pp-feeditem__text">{{ stripHtml(bodyText(f)) }}</p>
            </template>

            <div v-if="content.showAttachments !== false && attachmentsOf(f).length" class="pp-atts">
              <button
                v-for="(att, j) in attachmentsOf(f)"
                :key="j"
                type="button"
                class="pp-att"
                :class="isImage(att) ? 'pp-att--img' : 'pp-att--file'"
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
              </button>
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
  "check-square": "M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11",
  paperclip: "M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48",
  send: "M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z",
  "file-plus": "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M12 18v-6M9 15h6",
  x: "M18 6L6 18M6 6l12 12",
};

export default {
  props: { content: { type: Object, required: true }, uid: { type: String, required: false } },
  emits: ["trigger-event"],
  data() {
    return {
      selectedFilter: this.content.activeFilter != null ? this.content.activeFilter : "all",
      page: 1,
      // ---- composer ----
      composerOpen: false,
      composerEmpty: true,
      mentionCount: 0,
      mentionOpen: false,
      mentionQuery: "",
      mentionIndex: 0,
      mentionRange: null,
      attachments: [],
      dragActive: false,
    };
  },
  watch: {
    "content.activeFilter"(v) { if (v != null) this.selectedFilter = v; },
    itemsLength(n) {
      const tp = Math.max(1, Math.ceil(n / this.pageSize));
      if (this.page > tp) this.page = tp;
    },
  },
  beforeUnmount() { this.attachments.forEach((a) => { if (a.url) try { URL.revokeObjectURL(a.url); } catch (e) {} }); },
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
    currentAvatar() { return this.imgUrl(this.content.currentUserAvatar); },
    composerActive() { return this.composerOpen || !this.composerEmpty || this.attachments.length > 0; },
    showTaskWidget() { return this.content.showTaskWidget !== false && this.mentionCount > 0; },
    // Mention source — accepts an array or a WeWeb collection ({ data: [...] }),
    // with configurable field names so it maps any user table.
    mentionUsers() {
      let u = this.content.users;
      if (u && !Array.isArray(u) && Array.isArray(u.data)) u = u.data;
      if (!Array.isArray(u)) return [];
      const lf = this.content.userLabelField || "name";
      const vf = this.content.userValueField || "id";
      const af = this.content.userAvatarField || "headshot";
      const sf = this.content.userSubtitleField || "";
      return u.map((o) => {
        if (o && typeof o === "object") {
          const id = o[vf] != null ? o[vf] : (o.id != null ? o.id : o.airtable_id);
          const name = String(o[lf] != null ? o[lf] : (o.name || o.label || o.title || ""));
          return { id, name, avatar: this.imgUrl(o[af]), subtitle: sf ? String(o[sf] || "") : "", raw: o };
        }
        return { id: o, name: String(o), avatar: "", subtitle: "" };
      }).filter((x) => x.name);
    },
    filteredMentionUsers() {
      const q = String(this.mentionQuery || "").toLowerCase();
      const list = this.mentionUsers;
      if (!q) return list.slice(0, 8);
      return list.filter((u) => u.name.toLowerCase().indexOf(q) !== -1 || String(u.subtitle || "").toLowerCase().indexOf(q) !== -1).slice(0, 8);
    },
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
    imgUrl(v) {
      if (Array.isArray(v)) v = v[0];
      if (v && typeof v === "object") return v.url || v.src || (v.thumbnails && v.thumbnails.small && v.thumbnails.small.url) || "";
      return v || "";
    },
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
    initials(name) { return (name || "").split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase(); },
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
    ownerId(f) {
      if (!f) return "";
      const u = f.user_id || (f.data && f.data.user_id);
      return (u && (u.user_auth_id || u.id)) || f.user_auth_id || f.userId || f.owner_id || "";
    },
    activityOf(f) {
      if (!f) return "";
      if (f.activity != null) return String(f.activity);
      if (f.data && f.data.activity != null) return String(f.data.activity);
      return "";
    },
    canDelete(f) {
      if (this.content.showDelete === false) return false;
      if (f && typeof f.canDelete === "boolean") return f.canDelete;
      if (f && typeof f.deletable === "boolean") return f.deletable;
      const raw = this.content.deletableActivities;
      const allow = Array.isArray(raw) ? raw : ["Message"];
      if (allow.length) {
        const act = this.activityOf(f).trim().toLowerCase();
        const ok = allow.some((a) => String(a).trim().toLowerCase() === act);
        if (!ok) return false;
      }
      if (this.content.deleteOwnOnly) {
        const owner = this.ownerId(f);
        const me = this.content.currentUserId;
        if (!(owner && me != null && me !== "" && String(owner) === String(me))) return false;
      }
      return true;
    },
    emitItem(i) { this.$emit("trigger-event", { name: "itemClick", event: { index: i } }); },
    emitDelete(i, f) { this.$emit("trigger-event", { name: "delete", event: { index: i, id: (f && f.id) != null ? f.id : "" } }); },
    emitAtt(i, j, att) {
      this.$emit("trigger-event", {
        name: "attachmentClick",
        event: {
          feedIndex: i, attachmentIndex: j,
          url: (att && att.url) || "",
          type: (att && (att.content_type || att.contentType || att.type)) || "",
          isImage: this.isImage(att),
          attachment: att || null,
        },
      });
    },

    // ---- composer: focus / state ----
    onComposerFocus() { this.composerOpen = true; },
    onComposerInput() { this.refreshComposerState(); this.detectMention(); },
    onComposerKeyup(e) {
      // Re-evaluate the @-token as the caret moves (arrows/backspace), but don't
      // fight the dropdown while it's being navigated.
      if (this.mentionOpen && (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter")) return;
      this.detectMention();
    },
    refreshComposerState() {
      const el = this.$refs.composer;
      if (!el) return;
      this.mentionCount = el.querySelectorAll(".pp-mention").length;
      this.composerEmpty = el.textContent.replace(/ /g, " ").trim() === "" && this.mentionCount === 0;
    },
    onPaste(e) {
      e.preventDefault();
      const text = ((e.clipboardData || window.clipboardData) || {}).getData ? (e.clipboardData || window.clipboardData).getData("text/plain") : "";
      if (text) document.execCommand("insertText", false, text);
      this.refreshComposerState();
    },
    onComposerKeydown(e) {
      if (this.mentionOpen && this.filteredMentionUsers.length) {
        if (e.key === "ArrowDown") { e.preventDefault(); this.mentionIndex = Math.min(this.mentionIndex + 1, this.filteredMentionUsers.length - 1); return; }
        if (e.key === "ArrowUp") { e.preventDefault(); this.mentionIndex = Math.max(this.mentionIndex - 1, 0); return; }
        if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); this.insertMention(this.filteredMentionUsers[this.mentionIndex] || this.filteredMentionUsers[0]); return; }
      }
      if (this.mentionOpen && e.key === "Escape") { e.preventDefault(); this.closeMention(); return; }
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); this.submitNote(); }
    },

    // ---- composer: @mention detection + insertion ----
    detectMention() {
      const el = this.$refs.composer;
      const sel = typeof window !== "undefined" ? window.getSelection() : null;
      if (!el || !sel || !sel.rangeCount) { this.closeMention(); return; }
      const range = sel.getRangeAt(0);
      const node = range.startContainer;
      // Only inside a text node within the composer.
      if (node.nodeType !== 3 || !el.contains(node)) { this.closeMention(); return; }
      const before = node.textContent.slice(0, range.startOffset);
      const m = /(^|\s| )@([^\s@ ]*)$/.exec(before);
      if (!m) { this.closeMention(); return; }
      const query = m[2];
      if (query !== this.mentionQuery) this.mentionIndex = 0;
      this.mentionQuery = query;
      this.mentionRange = { node, start: range.startOffset - query.length - 1, end: range.startOffset };
      this.mentionOpen = true;
    },
    closeMention() { this.mentionOpen = false; this.mentionQuery = ""; this.mentionRange = null; },
    insertMention(user) {
      const el = this.$refs.composer;
      if (!el || !this.mentionRange) { this.closeMention(); return; }
      const { node, start, end } = this.mentionRange;
      let range;
      try {
        range = document.createRange();
        range.setStart(node, start);
        range.setEnd(node, end);
        range.deleteContents();
      } catch (e) { this.closeMention(); return; }
      const pill = document.createElement("span");
      pill.className = "pp-mention";
      pill.setAttribute("contenteditable", "false");
      pill.setAttribute("data-id", user.id != null ? String(user.id) : "");
      pill.setAttribute("data-name", user.name);
      pill.textContent = "@" + user.name;
      range.insertNode(pill);
      // trailing space so typing continues normally
      const space = document.createTextNode(" ");
      if (pill.parentNode) pill.parentNode.insertBefore(space, pill.nextSibling);
      // caret after the space
      const sel = window.getSelection();
      const after = document.createRange();
      after.setStart(space, 1);
      after.collapse(true);
      sel.removeAllRanges();
      sel.addRange(after);
      el.focus();
      this.closeMention();
      this.refreshComposerState();
    },

    // ---- composer: serialize ----
    serialize() {
      const el = this.$refs.composer;
      const mentions = [];
      const seen = {};
      let text = "";
      const walk = (nodes) => {
        nodes.forEach((n) => {
          if (n.nodeType === 3) { text += n.textContent; return; }
          if (n.nodeType !== 1) return;
          if (n.classList && n.classList.contains("pp-mention")) {
            const id = n.getAttribute("data-id") || "";
            const name = n.getAttribute("data-name") || n.textContent.replace(/^@/, "");
            const key = id || name;
            if (!seen[key]) { seen[key] = true; mentions.push({ id, name }); }
            text += "@" + name;
            return;
          }
          if (n.tagName === "BR") { text += "\n"; return; }
          walk(Array.from(n.childNodes));
          if (/^(DIV|P)$/.test(n.tagName)) text += "\n";
        });
      };
      if (el) walk(Array.from(el.childNodes));
      return { text: text.replace(/ /g, " ").replace(/\n{3,}/g, "\n\n").trim(), mentions, html: el ? el.innerHTML : "" };
    },

    // ---- composer: attachments ----
    triggerFile() { if (this.$refs.file) this.$refs.file.click(); },
    onFileInput(e) { this.addFiles(e.target.files); e.target.value = ""; },
    onDrop(e) { this.dragActive = false; this.addFiles(e.dataTransfer && e.dataTransfer.files); },
    addFiles(fileList) {
      const files = Array.from(fileList || []);
      files.forEach((file) => {
        const isImg = (file.type || "").indexOf("image/") === 0;
        this.attachments.push({ file, name: file.name, size: file.size, type: file.type, isImage: isImg, url: isImg ? URL.createObjectURL(file) : "" });
      });
      this.composerOpen = true;
    },
    removeAttachment(i) {
      const a = this.attachments[i];
      if (a && a.url) try { URL.revokeObjectURL(a.url); } catch (e) {}
      this.attachments.splice(i, 1);
    },

    // ---- composer: submit / task / cancel ----
    submitNote() {
      const { text, mentions, html } = this.serialize();
      if (!text && !this.attachments.length) return;
      this.$emit("trigger-event", {
        name: "noteSubmit",
        event: {
          text, html,
          mentions,
          mentionIds: mentions.map((m) => m.id),
          files: this.attachments.map((a) => a.file),
          attachments: this.attachments.map((a) => ({ name: a.name, size: a.size, type: a.type })),
        },
      });
      this.resetComposer();
    },
    emitAddTask() {
      const { text, mentions } = this.serialize();
      this.$emit("trigger-event", {
        name: "addTask",
        event: { description: text, mentions, mentionIds: mentions.map((m) => m.id) },
      });
    },
    cancelComposer() { this.resetComposer(); },
    resetComposer() {
      if (this.$refs.composer) this.$refs.composer.innerHTML = "";
      this.attachments.forEach((a) => { if (a.url) try { URL.revokeObjectURL(a.url); } catch (e) {} });
      this.attachments = [];
      this.mentionCount = 0;
      this.composerEmpty = true;
      this.composerOpen = false;
      this.closeMention();
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
  --shadow-pop: 0 12px 32px rgba(16, 24, 40, 0.16);
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
  --shadow-pop: 0 16px 40px rgba(0, 0, 0, 0.5);
}
.pp-root.pp-dark { @include dark; }
@media (prefers-color-scheme: dark) { .pp-root.pp-auto { @include dark; } }

.pp-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); padding: clamp(16px, 2.4vw, 24px); }
.pp-card__header { margin-bottom: 16px; }

/* ---- composer ---- */
.pp-composer { display: flex; gap: 14px; margin-bottom: 20px; }
.pp-composer__avatar { flex: none; display: grid; place-items: center; width: 40px; height: 40px; border-radius: 50%; overflow: hidden; background: color-mix(in srgb, var(--accent) 16%, transparent); color: var(--accent); font-weight: 700; font-size: 13px; }
.pp-composer__avatar img { width: 100%; height: 100%; object-fit: cover; }
.pp-composer__main { flex: 1; min-width: 0; }
.pp-composer__inputwrap { position: relative; }
.pp-composer__input {
  min-height: 44px; padding: 11px 110px 11px 14px; border: 1px solid var(--border-strong); border-radius: 12px;
  background: var(--surface); color: var(--text); font-size: 13.5px; line-height: 1.55; outline: none;
  white-space: pre-wrap; overflow-wrap: anywhere; transition: border-color .15s, box-shadow .15s;
}
.pp-composer--active .pp-composer__input { min-height: 76px; }
.pp-composer__input:focus { border-color: var(--primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 16%, transparent); }
.pp-composer__input:empty::before { content: attr(data-placeholder); color: var(--text-subtle); pointer-events: none; }
.pp-composer__input :deep(.pp-mention) {
  display: inline; padding: 1px 6px; margin: 0 1px; border-radius: 6px; font-weight: 600;
  color: var(--info); background: color-mix(in srgb, var(--info) 12%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--info) 40%, transparent); white-space: nowrap;
}

/* task widget floating top-right of the input */
.pp-taskwidget {
  position: absolute; top: 8px; right: 8px; display: inline-flex; align-items: center; gap: 7px;
  padding: 7px 11px; border-radius: 10px; background: var(--surface); border: 1px solid var(--border);
  box-shadow: var(--shadow-sm); color: var(--text); font-size: 12.5px; font-weight: 600; cursor: pointer;
  transition: border-color .15s, transform .1s, box-shadow .15s;
}
.pp-taskwidget:hover { border-color: var(--primary); box-shadow: var(--shadow); }
.pp-taskwidget:active { transform: translateY(1px); }
.pp-taskwidget .pp-svg { width: 15px; height: 15px; color: var(--primary); }

/* @mention dropdown */
.pp-mentionmenu {
  position: absolute; top: calc(100% + 6px); left: 0; z-index: 40; width: min(320px, 100%);
  max-height: 264px; overflow-y: auto; padding: 6px; background: var(--surface); border: 1px solid var(--border);
  border-radius: 12px; box-shadow: var(--shadow-pop); display: flex; flex-direction: column; gap: 2px;
}
.pp-mentionitem { display: flex; align-items: center; gap: 10px; width: 100%; text-align: left; padding: 8px 10px; border: none; background: none; border-radius: 8px; cursor: pointer; font: inherit; color: var(--text); }
.pp-mentionitem:hover, .pp-mentionitem--active { background: var(--surface-2); }
.pp-mentionitem__avatar { flex: none; display: grid; place-items: center; width: 30px; height: 30px; border-radius: 50%; overflow: hidden; background: color-mix(in srgb, var(--accent) 16%, transparent); color: var(--accent); font-size: 11px; font-weight: 700; }
.pp-mentionitem__avatar img { width: 100%; height: 100%; object-fit: cover; }
.pp-mentionitem__name { flex: 0 1 auto; font-size: 13.5px; font-weight: 600; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pp-mentionitem__sub { flex: none; margin-left: auto; font-size: 12px; color: var(--text-subtle); }
.pp-mentionmenu__empty { padding: 12px; font-size: 12.5px; color: var(--text-subtle); text-align: center; }

/* expanded footer */
.pp-composer__foot { margin-top: 10px; }
.pp-drop {
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
  padding: 18px; border: 1.5px dashed color-mix(in srgb, var(--primary) 45%, var(--border-strong));
  border-radius: 12px; background: color-mix(in srgb, var(--primary) 5%, transparent);
  color: var(--text-muted); font-size: 12.5px; font-weight: 600; cursor: pointer; text-align: center;
  transition: border-color .15s, background .15s;
}
.pp-drop:hover, .pp-drop--over { border-color: var(--primary); background: color-mix(in srgb, var(--primary) 10%, transparent); }
.pp-drop .pp-svg { width: 22px; height: 22px; color: var(--primary); }
.pp-drop__input { display: none; }

.pp-attpreview { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
.pp-attchip { position: relative; }
.pp-attchip--img { width: 60px; height: 60px; border-radius: 10px; overflow: hidden; border: 1px solid var(--border); background: var(--surface-2); }
.pp-attchip--img img { width: 100%; height: 100%; object-fit: cover; display: block; }
.pp-attchip--file { display: inline-flex; align-items: center; gap: 7px; max-width: 220px; padding: 8px 28px 8px 11px; border-radius: 9px; border: 1px solid var(--border); background: var(--surface-2); color: var(--text-muted); font-size: 12.5px; font-weight: 600; }
.pp-attchip--file .pp-svg { width: 15px; height: 15px; flex: none; color: var(--danger); }
.pp-attchip__name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pp-attchip__x { position: absolute; top: -6px; right: -6px; display: grid; place-items: center; width: 20px; height: 20px; border-radius: 50%; border: none; background: var(--text); color: var(--surface); cursor: pointer; box-shadow: var(--shadow-sm); }
.pp-attchip__x .pp-svg { width: 12px; height: 12px; }
.pp-attchip--file .pp-attchip__x { top: 50%; right: 6px; transform: translateY(-50%); width: 18px; height: 18px; background: transparent; color: var(--text-subtle); box-shadow: none; }
.pp-attchip--file .pp-attchip__x:hover { color: var(--danger); }

.pp-composer__actions { display: flex; align-items: center; gap: 8px; margin-top: 12px; }
.pp-composer__spacer { flex: 1; }
.pp-composer__tool { display: grid; place-items: center; width: 36px; height: 36px; border-radius: 9px; border: 1px solid var(--border); background: var(--surface); color: var(--text-muted); cursor: pointer; transition: background .15s, color .15s, border-color .15s; }
.pp-composer__tool:hover { background: var(--surface-2); color: var(--text); border-color: var(--border-strong); }
.pp-composer__tool .pp-svg { width: 17px; height: 17px; }
.pp-btn { display: inline-flex; align-items: center; gap: 7px; padding: 9px 16px; border-radius: 10px; border: 1px solid transparent; font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap; font-family: inherit; transition: filter .15s, background .15s, color .15s; }
.pp-btn .pp-svg { width: 15px; height: 15px; }
.pp-btn--primary { background: var(--primary); color: #fff; box-shadow: 0 6px 16px color-mix(in srgb, var(--primary) 32%, transparent); }
.pp-btn--primary:hover:not(:disabled) { filter: brightness(1.06); }
.pp-btn--primary:disabled { opacity: .5; cursor: not-allowed; box-shadow: none; }
.pp-btn--ghost { background: transparent; color: var(--text-muted); }
.pp-btn--ghost:hover { background: var(--surface-2); color: var(--text); }

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
.pp-att { text-decoration: none; cursor: pointer; font-family: inherit; padding: 0; }
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
