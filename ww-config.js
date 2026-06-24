export default {
  editor: { label: { en: "Feed" } },
  triggerEvents: [
    { name: "itemClick", label: { en: "On item click" }, event: { index: 0 } },
    { name: "attachmentClick", label: { en: "On attachment click" }, event: { feedIndex: 0, attachmentIndex: 0, url: "" } },
    { name: "filterChange", label: { en: "On filter click" }, event: { value: "all" } },
    { name: "delete", label: { en: "On delete click" }, event: { index: 0, id: "" } },
    { name: "pageChange", label: { en: "On page change" }, event: { page: 1 } },
  ],
  properties: {
    title: { label: { en: "Title" }, type: "Text", defaultValue: "Feed", bindable: true },
    paginate: { label: { en: "Paginate (built-in)" }, type: "OnOff", defaultValue: true, bindable: true },
    pageSize: { label: { en: "Items per page" }, type: "Number", options: { min: 1, max: 100, step: 1 }, defaultValue: 5, bindable: true },
    showDelete: { label: { en: "Show delete icon" }, type: "OnOff", defaultValue: true, bindable: true },
    showAttachments: { label: { en: "Show attachments" }, type: "OnOff", defaultValue: true, bindable: true },
    renderHtml: { label: { en: "Render body as rich text (HTML)" }, type: "OnOff", defaultValue: true, bindable: true },
    showFilters: { label: { en: "Show filters" }, type: "OnOff", defaultValue: true, bindable: true },
    filters: {
      label: { en: "Filters" }, type: "Array", bindable: true,
      defaultValue: [
        { label: "All Activity", value: "all" },
        { label: "Updates", value: "updates" },
        { label: "Messages", value: "messages" },
      ],
    },
    activeFilter: { label: { en: "Active filter value" }, type: "Text", defaultValue: "all", bindable: true },
    items: {
      label: { en: "Feed items" }, type: "Array", bindable: true,
      // Auto-recognizes activity_feed shape: { action, description, activity, created_at,
      // user_id: { name, headshot }, attachments: [{ url, content_type, thumbnail_url }] }
      // Also accepts the simple shape { author, time, text, avatar }.
      defaultValue: [
        {
          id: "1", action: "Estimate Created", description: "EST#1728 Created",
          created_at: "2026-06-22T13:43:54+00:00", activity: "Record created",
          user_id: { name: "Jay Helvey", headshot: "" }, attachments: [],
        },
        {
          id: "2", action: "Note added",
          description: "Confirmed lockbox access for the crew. Please knock first — dog inside.",
          created_at: "2026-06-21T09:12:00+00:00",
          user_id: { name: "Joshua Watson", headshot: "" },
          attachments: [
            { id: "a1", url: "#", content_type: "image/jpeg", thumbnail_url: "" },
            { id: "a2", url: "#", content_type: "application/pdf", thumbnail_url: null },
          ],
        },
        {
          id: "3", action: "Manifold installed",
          description: "Manifold installed, pressure test scheduled for tomorrow morning.",
          created_at: "2026-06-22T11:00:00+00:00",
          user_id: { name: "Charlie Binder", headshot: "" }, attachments: [],
        },
      ],
    },
    primaryColor: { label: { en: "Primary color" }, type: "Color", defaultValue: "#10b981", bindable: true },
    accentColor: { label: { en: "Accent color" }, type: "Color", defaultValue: "#6366f1", bindable: true },
    darkMode: {
      label: { en: "Theme mode" }, type: "TextSelect",
      options: { options: [
        { value: "auto", label: { en: "Auto (system)" } },
        { value: "light", label: { en: "Light" } },
        { value: "dark", label: { en: "Dark" } },
      ] }, defaultValue: "auto", bindable: true,
    },
    radius: { label: { en: "Corner radius (px)" }, type: "Number", options: { min: 0, max: 32, step: 1 }, defaultValue: 16, bindable: true },
  },
};
