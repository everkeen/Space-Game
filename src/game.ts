import * as three from 'three';

function loadFonts(): void {
    const fontLink = document.createElement('link');
    fontLink.href = 'fonts/Perfect DOS VGA 437 Win.ttf.css';
    fontLink.rel = 'stylesheet';
    document.head.appendChild(fontLink);
}

loadFonts();

function makeWindowDiv(window_id: string, title: string = 'Window'): HTMLElement {
    const div = document.createElement('div');
    div.id = window_id;
    div.classList.add('window');
    const toolbar = document.createElement('div');
    toolbar.id = `${window_id}-toolbar`;
    toolbar.classList.add('window-toolbar');
    div.appendChild(toolbar);
    const content = document.createElement('div');
    content.id = `${window_id}-content`;
    content.classList.add('window-content');
    div.appendChild(content);
    return div;
}

function clamp(num: number, lower: number, upper: number) {
    return Math.min(Math.max(num, lower), upper);
}

class InputManager {
    _window: WindowElement;

    constructor(window: WindowElement) {
        this._window = window;
    }
    _mousex: number = 0;
    _mousey: number = 0;
    _mousebuttons: number = 0;
    _keys: Set<string> = new Set();

    public get keys(): Set<string> {
        this.refreshInputs();
        return this._keys;
    }

    public get mousex(): number {
        this.refreshInputs();
        return this._mousex;
    }

    public get mousey(): number {
        this.refreshInputs();
        return this._mousey;
    }

    public get mouse(): { x: number; y: number; buttons: number } {
        this.refreshInputs();
        return { x: this._mousex, y: this._mousey, buttons: this._mousebuttons };
    }

    public get mousebuttons(): number {
        this.refreshInputs();
        return this._mousebuttons;
    }


    refreshInputs(): void {
        const mouseInput = this._window.getMouseInput();
        this._mousex = mouseInput.x;
        this._mousey = mouseInput.y;
        this._mousebuttons = mouseInput.buttons;
        this._keys = new Set(this._window.keys);
    }

    keyDown(key: string): boolean {
        this.refreshInputs();
        return this._keys.has(key);
    }

    keyUp(key: string): boolean {
        this.refreshInputs();
        return !this._keys.has(key);
    }

    getInputState(): { mouse: { x: number; y: number; buttons: number }; keys: Set<string> } {
        this.refreshInputs();
        return {
            mouse: { x: this._mousex, y: this._mousey, buttons: this._mousebuttons },
            keys: new Set(this._keys)
        };
    }
}

class WindowElement extends HTMLElement {
    id: string;
    fullscreen: boolean = false;
    title: string;
    mousex: number = 0;
    mousey: number = 0;
    mousebuttons: number = 0;
    pointerlock: boolean = false;
    keys: Set<string> = new Set();
    _isDragging: boolean = false;
    _inputManager?: InputManager;

    constructor(id?: string, title?: string, fullscreen?: boolean) {
        super();
        if (!id) {
            id = this.getAttribute('id') || `window-${Math.random().toString(36).substring(2, 11)}`;
        }
        if (!title) {
            title = this.getAttribute('title') || 'Window';
        }
        this.fullscreen = fullscreen || this.hasAttribute('fullscreen');
        this.id = id;
        this.title = title;
        this._inputManager = undefined;
        this.attachShadow({ mode: 'open' });
        if (!this.shadowRoot) return;
        const div = makeWindowDiv(id, title);
        const linkElem = document.createElement('link');
        linkElem.setAttribute('rel', 'stylesheet');
        linkElem.setAttribute('href', 'styles/main.css');
        this.shadowRoot.appendChild(linkElem);
        if (this.fullscreen) {
            div.style.width = '100%';
            div.style.height = '100%';
            div.style.left = '0';
            div.style.top = '0';
        }
        else {
            div.style.width = '800px';
            div.style.height = '600px';
        }
        this.shadowRoot.appendChild(div);
        this._hideChildElements();
        this.onchange = () => {
            this._hideChildElements();
            this.regenerateContent();
        };
        this.regenerateContent();
        this._isDragging = false;
        this._setupDragging();
        this._setupResizing();
        this._setupFocusing();
        this._setupInputTracking();
    }

    getInputManager(): InputManager {
        if (!this._inputManager) {
            this._inputManager = new InputManager(this);
        }
        return this._inputManager;
    }

    _setupInputTracking(): void {
        const windowDiv = this.shadowRoot?.getElementById(this.id);
        if (!windowDiv) return;
        windowDiv.setAttribute('tabindex', '0');
        windowDiv.addEventListener('mousemove', (e: MouseEvent) => {
            if (this.pointerlock) {
                this.mousex = e.movementX;
                this.mousey = e.movementY;
                return;
            }
            this.mousex = e.clientX - windowDiv.getBoundingClientRect().left;
            this.mousey = e.clientY - windowDiv.getBoundingClientRect().top;
        });
        // Reset mouse movement when pointer is locked and not moving
        windowDiv.addEventListener('mouseenter', () => {
            if (this.pointerlock) {
                this.mousex = 0;
                this.mousey = 0;
            }
        });
        setInterval(() => {
            if (this.pointerlock) {
                this.mousex = 0;
                this.mousey = 0;
            }
        }, 16); // Reset every frame (~60fps)
        windowDiv.addEventListener('mousedown', (e: MouseEvent) => {
            this.mousebuttons |= 1 << (e.button);
        });
        windowDiv.addEventListener('mouseup', (e: MouseEvent) => {
            this.mousebuttons &= ~(1 << (e.button));
        });
        windowDiv.addEventListener('mouseleave', () => {
            this.mousebuttons = 0;
        });
        windowDiv.addEventListener('keydown', (e: KeyboardEvent) => {
            this.keys.add(e.key);
        });
        windowDiv.addEventListener('keyup', (e: KeyboardEvent) => {
            this.keys.delete(e.key);
        });
    }

    _hideChildElements(): void {
        // Hide non-shadow children
        Array.from(this.children).forEach((child: Element) => {
            if ((child as HTMLElement).style.display === 'none') return;
            child.setAttribute('data-child-hidden', (child as HTMLElement).style.display);
            (child as HTMLElement).style.display = 'none';
        });
    }

    _setupFocusing(): void {
        const windowDiv = this.shadowRoot?.getElementById(this.id);
        if (!windowDiv) return;
        windowDiv.onfocus = () => {
            windowDiv.style.zIndex = '500';
            this.exFocus();
        }
        windowDiv.onblur = () => {
            windowDiv.style.zIndex = '1';
            this.mousebuttons = 0;
            this.keys.clear();
            this.exBlur();
        }
        windowDiv.addEventListener('mousedown', () => {
            windowDiv.focus();
        });
    }

    exFocus(): void { } // Overrideable focus method
    exBlur(): void { } // Overrideable blur method

    _setupDragging(): void {
        const toolbar = this.shadowRoot?.getElementById(`${this.id}-toolbar`);
        const windowDiv = this.shadowRoot?.getElementById(this.id);
        if (!toolbar || !windowDiv) return;
        let offsetX = 0;
        let offsetY = 0;
        toolbar.addEventListener('mousedown', (e: MouseEvent) => {
            this._isDragging = true;
            const rect = windowDiv.getBoundingClientRect();
            offsetX = e.clientX - rect.left;
            offsetY = e.clientY - rect.top;
            toolbar.style.cursor = 'grabbing';
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
        toolbar.addEventListener('mouseenter', () => {
            toolbar.style.cursor = 'grab';
        });
        toolbar.addEventListener('mouseleave', () => {
            if (!this._isDragging) {
                toolbar.style.cursor = 'default';
            }
        });
        const onMouseMove = (e: MouseEvent) => {
            if (!this._isDragging) return;
            const desktop = document.querySelector('main');
            if (!desktop) return;
            // Calculate absolute position within desktop bounds (absoluteY accounts for topbar height)
            const absoluteX = clamp(e.clientX - offsetX, 0, desktop.clientWidth - windowDiv.offsetWidth);
            const absoluteY = clamp(e.clientY - offsetY, 40, desktop.clientHeight - windowDiv.offsetHeight);
            windowDiv.style.left = `${absoluteX}px`;
            windowDiv.style.top = `${absoluteY}px`;
            toolbar.style.cursor = 'grabbing';
        };
        const onMouseUp = () => {
            this._isDragging = false;
            toolbar.style.cursor = 'grab';
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
    }

    _setupResizing(): void {
        const windowDiv = this.shadowRoot?.getElementById(this.id);
        if (!windowDiv) return;

        let isResizing = false;
        let resizeDirection = '';
        let startX = 0;
        let startY = 0;
        let startWidth = 0;
        let startHeight = 0;
        let startLeft = 0;
        let startTop = 0;

        const getResizeDirection = (e: MouseEvent, rect: DOMRect): string => {
            const edgeThreshold = 10;
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            let direction = '';
            if (y < edgeThreshold) direction += 'n';
            if (y > rect.height - edgeThreshold) direction += 's';
            if (x < edgeThreshold) direction += 'w';
            if (x > rect.width - edgeThreshold) direction += 'e';

            return direction;
        };

        windowDiv.addEventListener('mousemove', (e: MouseEvent) => {
            if (this._isDragging || isResizing) return;
            const rect = windowDiv.getBoundingClientRect();
            const direction = getResizeDirection(e, rect);

            if (direction) {
                windowDiv.style.cursor = `${direction}-resize`;
            } else {
                windowDiv.style.cursor = 'default';
            }
        });

        windowDiv.addEventListener('mousedown', (e: MouseEvent) => {
            const rect = windowDiv.getBoundingClientRect();
            resizeDirection = getResizeDirection(e, rect);

            if (resizeDirection) {
                isResizing = true;
                startX = e.clientX;
                startY = e.clientY;
                startWidth = rect.width;
                startHeight = rect.height;
                startLeft = rect.left;
                startTop = rect.top;

                e.preventDefault();
                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            }
        });

        const onMouseMove = (e: MouseEvent) => {
            if (!isResizing || this._isDragging) return;

            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            if (resizeDirection.includes('e')) {
                windowDiv.style.width = `${Math.max(100, startWidth + dx)}px`;
            }
            if (resizeDirection.includes('s')) {
                windowDiv.style.height = `${Math.max(100, startHeight + dy)}px`;
            }
            if (resizeDirection.includes('w')) {
                const newWidth = Math.max(100, startWidth - dx);
                windowDiv.style.width = `${newWidth}px`;
                windowDiv.style.left = `${startLeft + (startWidth - newWidth)}px`;
            }
            if (resizeDirection.includes('n')) {
                const newHeight = Math.max(100, startHeight - dy);
                windowDiv.style.height = `${newHeight}px`;
                windowDiv.style.top = `${startTop + (startHeight - newHeight)}px`;
            }
        };

        const onMouseUp = () => {
            isResizing = false;
            resizeDirection = '';
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };
    }

    regenerateContent(): void {
        const content = this.shadowRoot?.getElementById(`${this.id}-content`);
        if (content) {
            content.innerHTML = '';
            const children = Array.from(this.children);
            children.forEach(child => {
                const clone = child.cloneNode(true) as HTMLElement;
                if (child.getAttribute('data-child-hidden') !== null) {
                    clone.style.display = child.getAttribute('data-child-hidden') || '';
                    child.removeAttribute('data-child-hidden');
                }
                content.appendChild(clone);
            });
        }
    }

    getMouseInput(): { x: number; y: number; buttons: number } {
        const windowDiv = this.shadowRoot?.getElementById(this.id);
        if (!windowDiv) return { x: 0, y: 0, buttons: 0 };
        return {
            x: this.mousex,
            y: this.mousey,
            buttons: this.mousebuttons
        };
    }

    getKeyInput(): Set<string> {
        return new Set(this.keys);
    }

    keyDown(key: string): boolean {
        return this.keys.has(key);
    }

    keyUp(key: string): boolean {
        return !this.keys.has(key);
    }

    getInputState(): { mouse: { x: number; y: number; buttons: number }; keys: Set<string> } {
        return {
            mouse: this.getMouseInput(),
            keys: this.getKeyInput()
        };
    }

    getChild(selector: string): HTMLElement | null {
        return this.shadowRoot?.querySelector(selector) as HTMLElement || null;
    }

    setPointerLock(enabled: boolean): void {
        const windowDiv = this.shadowRoot?.getElementById(this.id);
        if (!windowDiv) return;
        if (enabled) {
            windowDiv.requestPointerLock();
            this.pointerlock = true;
        } else {
            document.exitPointerLock();
            this.pointerlock = false;
        }
    }
}


customElements.define('window-element', WindowElement);

interface Biome {
    name: string;
    temperatureRange: [number, number];
    humidityRange: [number, number];
    heightRange?: [number, number];
    color: three.Color | number | string;
    weight: number;
}

document.addEventListener('DOMContentLoaded', () => {
    let gameWindow = document.getElementById('space-game') as WindowElement;
    if (!gameWindow) {
        while (!gameWindow) {
            gameWindow = document.getElementById('space-game') as WindowElement;
        }
    }
    const inputs = gameWindow.getInputManager();
    const canvas = gameWindow.getChild('#gameCanvas') as HTMLCanvasElement;
    if (canvas) {
        function generateNoiseMap(
            width: number,
            height: number,
            seed: number,
            scale: number = 0.1,
            octaves: number = 4,
            persistence: number = 0.5,
            lacunarity: number = 2.0,
            offsetX: number = 0,
            offsetY: number = 0
        ): number[][] {
            // Simple 2D Perlin-like noise implementation
            const permutation: number[] = [];
            for (let i = 0; i < 256; i++) {
                permutation[i] = i;
            }

            // Seeded random number generator
            const seededRandom = (s: number) => {
                s = Math.sin(s) * 10000;
                return s - Math.floor(s);
            };

            // Fisher-Yates shuffle with seeded random
            for (let i = 255; i > 0; i--) {
                const j = Math.floor(seededRandom(seed + i) * (i + 1));
                [permutation[i], permutation[j]] = [permutation[j], permutation[i]];
            }
            const p = [...permutation, ...permutation];

            const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
            const lerp = (t: number, a: number, b: number) => a + t * (b - a);
            const grad = (hash: number, x: number, y: number) => {
                const h = hash & 3;
                const u = h < 2 ? x : y;
                const v = h < 2 ? y : x;
                return ((h & 1) ? -u : u) + ((h & 2) ? -v : v);
            };

            const noise = (x: number, y: number): number => {
                const X = Math.floor(x) & 255;
                const Y = Math.floor(y) & 255;
                x -= Math.floor(x);
                y -= Math.floor(y);
                const u = fade(x);
                const v = fade(y);
                const a = p[X] + Y;
                const b = p[X + 1] + Y;
                return lerp(v,
                    lerp(u, grad(p[a], x, y), grad(p[b], x - 1, y)),
                    lerp(u, grad(p[a + 1], x, y - 1), grad(p[b + 1], x - 1, y - 1))
                );
            };

            const noiseMap: number[][] = [];
            for (let y = 0; y < height; y++) {
                noiseMap[y] = [];
                for (let x = 0; x < width; x++) {
                    let amplitude = 1;
                    let frequency = 1;
                    let noiseValue = 0;

                    for (let octave = 0; octave < octaves; octave++) {
                        const sampleX = (x + offsetX) * scale * frequency;
                        const sampleY = (y + offsetY) * scale * frequency;

                        noiseValue += noise(sampleX, sampleY) * amplitude;

                        amplitude *= persistence;
                        frequency *= lacunarity;
                    }

                    // Normalize to 0-1 range
                    noiseMap[y][x] = (noiseValue + 1) / 2;
                }
            }

            return noiseMap;
        }

        function generateTerrainMesh(size: number, segments: number, seed: number, scale: number = 0.05, octaves: number = 8, persistence: number = 0.4, lacunarity: number = 2.0, amplitude: number = 0.05, offsetX: number = 0, offsetY: number = 0, tempModifier: number = 0, humidModifier: number = 0): three.Mesh {
            const geometry = new three.PlaneGeometry(size, size, segments, segments);
            const noiseMap = generateNoiseMap(segments + 1, segments + 1, seed, scale, octaves, persistence, lacunarity, offsetX, offsetY);

            let temperatureMap: number[][] = generateNoiseMap(256, 256, seed, 0.01, 4, 0.5, 2.0, offsetX, offsetY);
            let humidityMap: number[][] = generateNoiseMap(256, 256, seed, 0.01, 4, 0.5, 2.0, offsetX, offsetY);
            for (let z = 0; z < temperatureMap.length; z++) {
                for (let x = 0; x < temperatureMap[z].length; x++) {
                    temperatureMap[z][x] = clamp(temperatureMap[z][x] + tempModifier, 0, 1);
                    humidityMap[z][x] = clamp(humidityMap[z][x] + humidModifier, 0, 1);
                }
            }
            // Calculate average temperature and humidity
            let totalTemp = 0;
            let totalHumid = 0;
            let count = 0;
            
            for (let z = 0; z < temperatureMap.length; z++) {
                for (let x = 0; x < temperatureMap[z].length; x++) {
                    totalTemp += temperatureMap[z][x];
                    totalHumid += humidityMap[z][x];
                    count++;
                }
            }
            
            const avgTemp = totalTemp / count;
            const avgHumid = totalHumid / count;
            
            console.log(`Average Temperature: ${avgTemp.toFixed(3)}, Average Humidity: ${avgHumid.toFixed(3)}`);
            let biomeMap: Biome[][] = [];

            for (let z = 0; z <= segments; z++) {
                biomeMap[z] = [];
                for (let x = 0; x <= segments; x++) {
                    const tempZ = Math.floor(z * 255 / segments);
                    const tempX = Math.floor(x * 255 / segments);
                    const temp = temperatureMap[tempZ][tempX];
                    const humid = humidityMap[tempZ][tempX];

                    // Find all viable biomes
                    const viableBiomes = biomes.filter(biome =>
                        temp >= biome.temperatureRange[0] && temp <= biome.temperatureRange[1] &&
                        humid >= biome.humidityRange[0] && humid <= biome.humidityRange[1] &&
                        (biome.heightRange ? (noiseMap[z][x] >= biome.heightRange[0] && noiseMap[z][x] <= biome.heightRange[1]) : true)
                    );

                    // Pick the biome with the highest weight, or default to first biome if none viable
                    let selectedBiome: Biome;
                    if (viableBiomes.length > 0) {
                        selectedBiome = viableBiomes.reduce((prev, current) =>
                            current.weight > prev.weight ? current : prev
                        );
                    } else {
                        selectedBiome = biomes[0];
                    }

                    biomeMap[z][x] = selectedBiome;
                }
            }
            console.log(biomeMap);

            // Rotate geometry before applying height so Y becomes up
            geometry.rotateX(-Math.PI / 2);

            for (let i = 0; i < geometry.attributes.position.count; i++) {
                const x = i % (segments + 1);
                const z = Math.floor(i / (segments + 1));
                const y = noiseMap[z][x] * amplitude; // Scale height based on terrain size
                geometry.attributes.position.setY(i, y);
            }
            geometry.attributes.position.needsUpdate = true;
            geometry.computeVertexNormals();
            const colors: number[] = [];
            for (let y = 0; y < biomeMap.length; y++) {
                for (let x = 0; x < biomeMap[y].length; x++) {
                    const color = new three.Color(biomeMap[y][x].color);
                    colors.push(color.r, color.g, color.b);
                }
            }
            geometry.setAttribute('color', new three.BufferAttribute(new Float32Array(colors), 3));
            const material = new three.MeshPhongMaterial({ vertexColors: true });
            return new three.Mesh(geometry, material);
        }
        let camera: three.PerspectiveCamera;
        let light: three.DirectionalLight;
        let renderer: three.WebGLRenderer;
        let scene: three.Scene;
        let terrain: three.Mesh;
        let randomCube: three.Mesh;
        let skybox: three.Mesh;
        let ambientLight: three.AmbientLight = new three.AmbientLight(0x454545); // Soft white ambient light
        let skyboxTexture: three.CubeTexture = new three.CubeTextureLoader()
            .setPath('textures/skybox/')
            .load([
                'px.png', 'nx.png',
                'py.png', 'ny.png',
                'pz.png', 'nz.png'
            ]);
        const biomes: Biome[] = [
            {
                name: 'Grassland',
                temperatureRange: [0.25, 0.5],
                humidityRange: [0.45, 0.6],
                color: new three.Color("#7CFC00"),
                weight: 2.0 
            },
            { 
                name: 'Tundra',
                temperatureRange: [0.0, 0.25],
                humidityRange: [0.45, 1],
                color: new three.Color("#D9FBFF"),
                weight: 1.0
            },
            { 
                name: 'Forest',
                temperatureRange: [0.25, 0.6],
                humidityRange: [0.6, 1.0],
                color: new three.Color("#376137"),
                weight: 1.0
            },
            { 
                name: 'Savanna',
                temperatureRange: [0.5, 0.75],
                humidityRange: [0.0, 0.5],
                color: new three.Color("#d7a100"),
                weight: 1.0
            },
            { 
                name: 'Desert',
                temperatureRange: [0.6, 1.0],
                humidityRange: [0.0, 0.3],
                color: new three.Color("#EDC9AF"),
                weight: 1.0
            },
            { 
                name: 'Tropical Rainforest',
                temperatureRange: [0.75, 1.0],
                humidityRange: [0.5, 1.0],
                color: new three.Color("#00853E"),
                weight: 1.0
            },
            { 
                name: 'Beach',
                temperatureRange: [0.5, 1.0],
                humidityRange: [0.3, 0.7],
                heightRange: [0.0, 0.3],
                color: new three.Color("#FFF5BA"),
                weight: 10
            },
            { 
                name: 'Ocean',
                temperatureRange: [0.0, 1.0],
                humidityRange: [0.0, 1.0],
                heightRange: [0.0, 0.15],
                color: new three.Color("#1E90FF"),
                weight: 100
            }
        ];
        function checkBiomes(): void {
            for (let i = 0; i < biomes.length; i++) {
                for (let j = i + 1; j < biomes.length; j++) {
                    const biome1 = biomes[i];
                    const biome2 = biomes[j];

                    // Check if any part of biome2's temperature range is within biome1's range
                    const tempOverlap = (biome2.temperatureRange[0] >= biome1.temperatureRange[0] && biome2.temperatureRange[0] <= biome1.temperatureRange[1]) ||
                        (biome2.temperatureRange[1] >= biome1.temperatureRange[0] && biome2.temperatureRange[1] <= biome1.temperatureRange[1]) ||
                        (biome1.temperatureRange[0] >= biome2.temperatureRange[0] && biome1.temperatureRange[0] <= biome2.temperatureRange[1]) ||
                        (biome1.temperatureRange[1] >= biome2.temperatureRange[0] && biome1.temperatureRange[1] <= biome2.temperatureRange[1]);

                    // Check if any part of biome2's humidity range is within biome1's range
                    const humidOverlap = (biome2.humidityRange[0] >= biome1.humidityRange[0] && biome2.humidityRange[0] <= biome1.humidityRange[1]) ||
                        (biome2.humidityRange[1] >= biome1.humidityRange[0] && biome2.humidityRange[1] <= biome1.humidityRange[1]) ||
                        (biome1.humidityRange[0] >= biome2.humidityRange[0] && biome1.humidityRange[0] <= biome2.humidityRange[1]) ||
                        (biome1.humidityRange[1] >= biome2.humidityRange[0] && biome1.humidityRange[1] <= biome2.humidityRange[1]);

                    if (tempOverlap && humidOverlap) {
                        console.warn(`Biome overlap detected: ${biome1.name} and ${biome2.name} have overlapping temperature and humidity ranges, which may cause noisy terrain`);
                    }
                }
            }
        }
        checkBiomes();
        const sunPosition = new three.Vector3(1, 1, 0).normalize();
        let skyboxGeometry: three.SphereGeometry;
        let skyboxMaterial: three.ShaderMaterial;
        const seed = Math.random() * 10000;
        function init() {
            renderer = new three.WebGLRenderer({ canvas: canvas });
            renderer.setSize(canvas.clientWidth, canvas.clientHeight);
            scene = new three.Scene();
            light = new three.DirectionalLight(0xffffff, 1);
            light.position.copy(sunPosition).normalize();
            scene.add(light);
            terrain = generateTerrainMesh(100, 1024, seed, 0.01, 8, 0.4, 2.0, 10, 0, 0, 0.5, -0.3);
            terrain.position.set(0, 0, 0);
            terrain.rotation.set(0, 0, 0);
            randomCube = new three.Mesh(
                new three.BoxGeometry(0.5, 0.5, 0.5),
                new three.MeshPhongMaterial({ color: 0x0000ff })
            );
            randomCube.position.set(0, 0.25, 0);
            scene.add(randomCube);
            scene.add(terrain);
            scene.add(ambientLight);
            // Create skybox shader material
            skyboxGeometry = new three.SphereGeometry(500, 32, 32);
            skyboxMaterial = new three.ShaderMaterial({
                uniforms: {
                    skybox: { value: skyboxTexture }
                },
                vertexShader: `
                    varying vec3 vPosition;
                    void main() {
                        vPosition = position;
                        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                    }
                `,
                fragmentShader: `
                    varying vec3 vPosition;
                    uniform samplerCube skybox;

                    void main()
                    {    
                        gl_FragColor = textureCube(skybox, vPosition);
                    }
                `,
                side: three.BackSide
            });

            skybox = new three.Mesh(skyboxGeometry, skyboxMaterial);
            scene.add(skybox);
            camera = new three.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
            camera.position.z = 5;
            camera.rotation.order = 'YXZ'; // Set rotation order to avoid gimbal lock
        } init();

        function update() {
            requestAnimationFrame(update);

            if (inputs.keyDown('Escape')) {
                gameWindow.blur();
            }

            // Maintain aspect ratio
            const aspectRatio = 16 / 9; // or use initial canvas aspect ratio
            const containerWidth = canvas.parentElement!.clientWidth;
            const containerHeight = canvas.parentElement!.clientHeight;

            let width, height;
            if (containerWidth / containerHeight > aspectRatio) {
                // Container is wider than aspect ratio
                height = containerHeight;
                width = height * aspectRatio;
            } else {
                // Container is taller than aspect ratio
                width = containerWidth;
                height = width / aspectRatio;
            }

            canvas.style.width = `${width}px`;
            canvas.style.height = `${height}px`;
            canvas.style.marginLeft = `${(containerWidth - width) / 2}px`;
            canvas.style.marginTop = `${(containerHeight - height) / 2}px`;
            canvas.width = width;
            canvas.height = height;

            camera.aspect = aspectRatio;
            camera.updateProjectionMatrix();
            // Create forward/backward/strafe vectors based on camera orientation
            const moveSpeed = 0.1;
            const forward = new three.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
            const right = new three.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
            const up = new three.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);

            if (inputs.keys.has('w')) {
                camera.position.addScaledVector(forward, moveSpeed);
            }
            if (inputs.keys.has('s')) {
                camera.position.addScaledVector(forward, -moveSpeed);
            }
            if (inputs.keys.has('a')) {
                camera.position.addScaledVector(right, -moveSpeed);
            }
            if (inputs.keys.has('d')) {
                camera.position.addScaledVector(right, moveSpeed);
            }
            if (inputs.keys.has('q')) {
                camera.position.addScaledVector(up, -moveSpeed);
            }
            if (inputs.keys.has('e')) {
                camera.position.addScaledVector(up, moveSpeed);
            }
            // Rotate camera using quaternions to avoid gimbal lock
            const rotateSpeed = 0.02;

            gameWindow.exFocus = () => {
                gameWindow.setPointerLock(true);
            };
            gameWindow.exBlur = () => {
                gameWindow.setPointerLock(false);
            };
            if (gameWindow.pointerlock) {
                const deltaX = inputs.mouse.x; // movementX when pointer is locked
                const deltaY = inputs.mouse.y;

                // Convert to Euler angles for easier pitch clamping
                const euler = new three.Euler().setFromQuaternion(camera.quaternion, 'YXZ');

                // Apply yaw (left/right rotation)
                euler.y -= rotateSpeed * deltaX;

                // Apply pitch with clamping (up/down rotation)
                const maxPitch = Math.PI / 2 - 0.01; // ~89 degrees
                euler.x = clamp(euler.x - rotateSpeed * deltaY, -maxPitch, maxPitch);

                // Keep roll at zero
                euler.z = 0;

                // Update camera quaternion from clamped Euler angles
                camera.quaternion.setFromEuler(euler);
            }
            renderer.setSize(width, height);
            skybox.position.copy(camera.position);
            renderer.render(scene, camera);

        }
        update();
    }
});

export { WindowElement };
