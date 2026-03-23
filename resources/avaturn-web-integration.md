# Avaturn Web SDK — Integration Reference
> Scraped from docs.avaturn.me — March 2026
> For Strands DemoOS Avatar Creator applet

---

## 1. Quick Start (HTML / JS / TS)

### HTML Container
```html
<div id="avaturn-sdk-container"></div>
```

### Optional CSS
```css
#avaturn-sdk-container {
  width: 100%;
  height: 100%;
  border: none;
}
```

### JavaScript Implementation
```javascript
<script type="module">
  import { AvaturnSDK } from "https://cdn.jsdelivr.net/npm/@avaturn/sdk/dist/index.js";

  function loadAvaturn() {
    const container = document.getElementById("avaturn-sdk-container");
    const subdomain = "strands"; // Our registered subdomain
    const url = `https://${subdomain}.avaturn.dev`;
    const sdk = new AvaturnSDK();

    sdk.init(container, { url })
      .then(() => {
        sdk.on("export", (data) => {
          // data.url = GLB file URL of the exported avatar
          console.log(data);
        });
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadAvaturn);
  } else {
    loadAvaturn();
  }
</script>
```

### Package Manager Alternative
```bash
npm install @avaturn/sdk
```
```javascript
import { AvaturnSDK } from '@avaturn/sdk';
```

---

## 2. SDK Init Parameters

```javascript
await sdk.init(container, {
  url: '<URL>',                    // Avaturn URL (subdomain.avaturn.dev or API session URL)
  iframeClassName: '<CSS_CLASS>',  // Optional: CSS class for the internal iframe
  disableUi: false,                // Optional: Hide default Avaturn UI for custom UI
});
```

**Note:** The SDK creates an iframe inside the container element. Do NOT pass an iframe element directly.

---

## 3. Callbacks / Events

### Export Event (Free tier)
Triggered when user clicks "Next" — returns avatar GLB data:
```javascript
sdk.on("export", (data) => {
  // data.url — GLB file URL
  // Process the exported avatar
});
```

### Load Event
```javascript
sdk.on("load", () => {
  // SDK fully loaded, safe to call methods
});
```

### Available Events (Paid tier for some)
- **export** — Avatar exported, returns GLB URL
- **asset_changed** — User changed a garment/asset
- **body_changed** — User changed body type
- **load** — SDK finished loading

**Important:** In `disableUi` mode, only `.on('load', fn)` callback fires.

---

## 4. Custom UI Mode (Paid)

Disable default UI and build your own:
```javascript
const scene = await sdk.init(container, {
  url: '<URL>',
  disableUi: true,
});

sdk.on('load', () => {
  // Get available options
  sdk.getBodyList().then((list) => { /* render body selector */ });
  sdk.getAssetList().then((list) => { /* render asset selector */ });
});

// Programmatically change items
sdk.setActiveAsset(id).then(() => console.log(`Asset changed: ${id}`));
sdk.setActiveBody(id).then(() => console.log(`Body changed: ${id}`));
```

---

## 5. SDK Types Reference

From `@avaturn/sdk v1.1.0`:

| Type | Description |
|------|-------------|
| `AvaturnSDK` | Main SDK class |
| `SdkCallback` | Event types for `sdk.on()` |
| `AnimationItem` | Animation definition |
| `AssetItem` | Wearable asset definition |
| `BodyItem` | Body type definition |
| `Category` | Asset category |
| `ColorValueHex` | Hex color string |
| `DefaultAssets` | Default asset configuration |
| `EditableBodyProportions` | Body proportion params |
| `ExportAvatarResult` | Export callback data shape |
| `EyeColorType` | Eye color enum |
| `Gender` | Gender enum |
| `InitParams` | Parameters for `sdk.init()` |

---

## 6. Paid API Flow (Sessions)

For paid tier, use the REST API to create sessions:
1. Call `POST /v1/sessions/new` → returns session URL
2. Pass session URL to `sdk.init()` instead of subdomain URL
3. Enables custom UI mode, all callbacks, asset filtering

---

## 7. Strands-Specific Notes

- **Subdomain:** `strands` → `https://strands.avaturn.dev`
- **Tier:** Free (sufficient for dev, limited users)
- **Export format:** GLB (Mixamo-compatible humanoid rig)
- **Integration point:** DemoOS Avatar Creator applet (`avatar-creator` in APP_REGISTRY)
- **Pipeline:** Avaturn iframe → export callback → GLB URL → Three.js AvatarPreview renderer
- **Game integration:** Same GLB loads into Signal Training v2 as player character

---

## Links
- Docs: https://docs.avaturn.me/docs/integration/web/html/
- SDK Reference: https://sdk-docs.avaturn.me
- Developer Portal: https://developer.avaturn.me
- Three.js Example Repo: https://github.com/avaturn/avaturn-threejs-example
