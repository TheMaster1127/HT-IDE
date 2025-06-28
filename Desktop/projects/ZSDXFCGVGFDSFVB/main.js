

/**
 * GUI System State
 * Stores references to elements, counters, and layout information.
 */
const guiState = {
    initialized: false,
    backgroundDiv: null,
    elements: {}, // Stores all GUI elements keyed by their ID { id: { elementRef, type, parentId, properties, children?, lastAutoPosChildElement? ... } }
    elementCounters: {}, // Stores counters for generating default IDs { div: 0, button: 0, text: 0, ... }
    lastAutoPosElement: { // For the top-level grid layout system
        id: null,
        x: 0, // Pixel value
        y: 0, // Pixel value
        width: 0, // Pixel value
        height: 0 // Pixel value
    },
    currentZIndex: 0, // For default z-index generation for top-level guiAdd divs
    autoPosGap: 20, // Gap for automatic grid layout
    idsInUse: new Set() // Keep track of all manually set and generated IDs
};
/**
 * Generates a unique default ID for an element type.
 * @param {string} elementType - The type of the element (e.g., 'div', 'button', 'text').
 * @returns {string} A unique ID (e.g., 'button0', 'text1').
 */
function generateDefaultId(elementType) {
    if (guiState.elementCounters[elementType] === undefined) {
        guiState.elementCounters[elementType] = 0;
    }
    let id;
    do {
        id = `${elementType}${guiState.elementCounters[elementType]++}`;
    } while (guiState.idsInUse.has(id)); // Ensure uniqueness
    guiState.idsInUse.add(id);
    return id;
}
/**
 * Parses a CSS property string (like '10px' or '50%') into value and unit.
 * Assumes 'px' if no unit is provided for numbers. Returns null for 'auto' or invalid.
 * @param {string | number | null} value - The value to parse.
 * @param {string} [defaultUnit='px'] - The default unit if only a number is given.
 * @returns {{value: number, unit: string} | null} - Parsed value and unit or null if not parsable numerically.
 */
function parseCssValue(value, defaultUnit = 'px') {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') {
        return { value: value, unit: defaultUnit };
    }
    if (typeof value === 'string') {
        const trimmedValue = value.trim().toLowerCase();
        if (trimmedValue === 'auto') {
            return null; // Cannot parse 'auto' numerically
        }
        const match = trimmedValue.match(/^(\d*\.?\d+)\s*([a-z%]*)$/);
        if (match) {
            const num = parseFloat(match[1]);
            const unit = match[2] || defaultUnit;
            return { value: num, unit: unit };
        }
    }
    // Allow number 0 specifically
    if (value === 0) {
        return { value: 0, unit: defaultUnit };
    }
    // console.warn(`Could not parse CSS value numerically: ${value}`); // Reduce noise
    return null; // Indicate parsing failure
}
/**
 * Applies raw CSS string to an element.
 * @param {HTMLElement} element - The element to apply styles to.
 * @param {string | null} rawCss - The raw CSS string (e.g., "color: red; font-weight: bold;").
 */
function applyRawCss(element, rawCss) {
    if (typeof rawCss === 'string' && rawCss.trim() !== '') {
        const styles = rawCss.split(';');
        styles.forEach(style => {
            if (style.trim() !== '') {
                const [property, value] = style.split(':').map(s => s.trim());
                if (property && value) {
                    const camelCaseProperty = property.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
                    try {
                        // Special handling for common properties that might have existing values cleared
                        if (element.style[camelCaseProperty] !== undefined) {
                             element.style[camelCaseProperty] = value;
                        } else {
                             // Use setProperty for custom properties or less common ones
                             element.style.setProperty(property, value);
                        }
                    } catch (e) {
                        console.warn(`Failed to apply raw CSS style: ${property}:${value}`, e);
                    }
                }
            }
        });
    }
}
/**
 * Parses the border string ("size color" or "size|color"). Prefers CSS standard space separation.
 * @param {string | null} borderString
 * @param {string} [defaultSize='1px'] - Default border size
 * @param {string} [defaultColor='transparent'] - Default border color
 * @returns {{ size: string, style: string, color: string } | null}
 */
function parseBorder(borderString, defaultSize = '1px', defaultColor = 'transparent') {
    if (borderString === null || borderString === undefined || String(borderString).trim() === '') return null;
    const str = String(borderString);
    // Prioritize pipe, then space
    const parts = str.includes('|') ? str.split('|').map(s => s.trim()) : str.split(/\s+/).map(s => s.trim());
    // Basic parsing: assumes size [style] color or just size or size color
    let size = defaultSize;
    let style = 'solid';
    let color = defaultColor;
    if (parts.length === 1) {
        // Is it a color or a size? Assume size if it looks like a CSS unit value
        if (parseCssValue(parts[0])) {
            size = parts[0];
        } else {
            color = parts[0]; // Assume it's a color name/hex
        }
    } else if (parts.length === 2) {
        // Assume "size color" or "size style" or "style color" - prioritize size/color
        // If first part looks like size, assume "size color"
        if (parseCssValue(parts[0])) {
             size = parts[0];
             color = parts[1];
        } else { // Assume "style color" or "color size"? Less common, default to size/color interpretation
            size = parts[0]; // May not be a valid size, CSS handles it
            color = parts[1];
        }
    } else if (parts.length >= 3) {
        size = parts[0];
        style = parts[1]; // Add style parsing if needed
        color = parts[2];
    }
    // Ensure size has a unit if it's just a number string that's not 0
     const parsedSize = parseCssValue(size, 'px');
     if (parsedSize && parsedSize.unit === 'px' && String(size) === String(parsedSize.value) && parsedSize.value !== 0) {
         size = `${parsedSize.value}px`;
     }
    return { size: size, style: style, color: color };
}
// ==========================================================================
// HELPER: APPLY ENABLED/DISABLED STYLES (REVISED FOR CURSOR)
// ==========================================================================
/**
 * Applies visual and functional styles based on the element's effective enabled state.
 * @param {HTMLElement} element - The DOM element.
 * @param {string} elementType - The type of the element ('button', 'text', 'div', etc.).
 * @param {boolean} isEffectivelyEnabled - The calculated enabled state (considering parent).
 * @param {object} properties - The element's stored properties (needed for callback check).
 */
function _applyEnabledStyles(element, elementType, isEffectivelyEnabled, properties) {
    // Visual indication (Opacity applies universally)
    element.style.opacity = isEffectivelyEnabled ? '1' : '0.5';
    // Functional indication (Pointer events & Cursor)
    if (elementType === 'div') {
        // --- Container DIV Specific Logic ---
        if (!isEffectivelyEnabled) {
            // Disabled Container:
            // - Apply 'not-allowed' cursor via class.
            // - *DO NOT* set pointer-events: none, so hover for cursor works.
            // - Interaction is blocked because children will have pointer-events: none.
            element.classList.add('gui-container-disabled');
            // Ensure pointer-events is not 'none' if previously set
            if (element.style.pointerEvents === 'none') {
                 element.style.pointerEvents = 'auto'; // Or '', restore default behaviour
            }
        } else {
            // Enabled Container:
            // - Remove class.
            // - Restore default pointer events.
            // - Reset cursor (let children define theirs).
            element.classList.remove('gui-container-disabled');
            element.style.pointerEvents = ''; // Default browser handling
            element.style.cursor = '';
        }
    } else {
        // --- Child Element Specific Logic ---
        element.style.pointerEvents = isEffectivelyEnabled ? 'auto' : 'none';
        // Specific disabled attribute for form elements
        if (element.tagName === 'BUTTON' || element.tagName === 'SELECT' || element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
            element.disabled = !isEffectivelyEnabled;
        }
        // Cursor for child elements
        element.style.cursor = ''; // Reset first
        if (isEffectivelyEnabled) {
            // Set appropriate cursor only if enabled
            const isInteractive = (
                ['button', 'toggle', 'picture', 'dropdown'].includes(elementType) ||
                ((elementType === 'rectangle' || elementType === 'circle') && properties?.callback)
            );
            if (isInteractive) {
                element.style.cursor = 'pointer';
            } else if (elementType === 'text') {
                element.style.cursor = 'default';
            } else if (elementType === 'edit'){
                element.style.cursor = 'text';
            }
        } else {
            // Child element is effectively disabled
            element.style.cursor = 'default'; // Use 'default' cursor for disabled children
        }
    }
}
// ==========================================================================
// GUI INIT FUNCTION
// ==========================================================================
/**
 * Initializes the main GUI background layer.
 * @param {string | null} [backgroundColor=null] - Background color (hex). Defaults to '#202020'.
 * @param {string | null} [centerText=null] - Text to display in the center. Defaults to null (no text).
 */
function guiInit(backgroundColor = null, centerText = null) {
    if (guiState.initialized) {
        console.warn("GUI already initialized. Re-initializing.");
        if (guiState.backgroundDiv && guiState.backgroundDiv.parentNode) {
            guiState.backgroundDiv.parentNode.removeChild(guiState.backgroundDiv);
        }
        // Reset state if re-initializing cleanly
        Object.keys(guiState.elements).forEach(id => {
             if (guiState.elements[id].elementRef && guiState.elements[id].elementRef.parentNode) {
                 guiState.elements[id].elementRef.parentNode.removeChild(guiState.elements[id].elementRef);
             }
        });
        guiState.elements = {};
        guiState.elementCounters = {};
        guiState.lastAutoPosElement = { id: null, x: 0, y: 0, width: 0, height: 0 };
        guiState.currentZIndex = 0;
        guiState.idsInUse.clear();
    }
    const finalBgColor = backgroundColor === null ? '#202020' : backgroundColor; // Match body style bg
    const bgDiv = document.createElement('div');
    bgDiv.id = 'gui-background';
    bgDiv.style.position = 'fixed';
    bgDiv.style.top = '0';
    bgDiv.style.left = '0';
    bgDiv.style.width = '100vw';
    bgDiv.style.height = '100vh';
    bgDiv.style.backgroundColor = finalBgColor;
    bgDiv.style.zIndex = '-1'; // Behind other content
    bgDiv.style.overflow = 'hidden'; // Prevent scrollbars
    if (typeof centerText === 'string' && centerText.trim() !== '') {
        const textElement = document.createElement('div');
        textElement.textContent = centerText;
        textElement.style.position = 'absolute';
        textElement.style.top = '50%';
        textElement.style.left = '50%';
        textElement.style.transform = 'translate(-50%, -50%)';
        textElement.style.color = 'white'; // Default color
        textElement.style.fontSize = '20px'; // Default size
        textElement.style.fontFamily = 'sans-serif'; // Default font
        textElement.style.textAlign = 'center';
        textElement.style.pointerEvents = 'none'; // Ignore clicks
        bgDiv.appendChild(textElement);
    }
    document.body.appendChild(bgDiv);
    guiState.backgroundDiv = bgDiv;
    guiState.initialized = true;
    console.log("GUI Initialized.");
}


async function main() {
    guiInit("#202020", "This is a GUI");

}
main();