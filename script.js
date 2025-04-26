// --- 获取 HTML 元素 ---
const canvas = document.getElementById('particleCanvas');
const ctx = canvas.getContext('2d');
const textInput = document.getElementById('textInput');
const updateButton = document.getElementById('updateButton');

// --- 配置 (VortexConfiguration Equivalent) ---
const config = {
    // --- Canvas/Window ---
    width: window.innerWidth,   // Use window size initially
    height: window.innerHeight,
    backgroundColor: 'rgba(0, 0, 0, 1)', // Equivalent to black background
    trailAlpha: 0.1,          // Trail effect (0 = no trail, 1 = no fade) - like Java's alpha/255

    // --- Particles ---
    numParticles: 5000,
    particleMaxSpeed: 4.5,     // Max speed limit
    particleMinSpeed: 0.0,     // Min speed near target (0 to disable)
    particleMinSize: 1,
    particleMaxSize: 2.5,

    // --- Forces ---
    attractionForce: 0.08,     // How strongly particles are pulled to target
    swirlForce: 0.005,        // Rotational force around center (0 to disable)
    damping: 0.99,           // Friction/slowdown factor (closer to 1 = less friction)

    // --- Color/Appearance ---
    hueShiftSpeed: 0.001,     // Hue shift per frame (0-1 corresponds to 0-360 degrees)
    saturation: 1.0,        // HSL Saturation (0-1) -> 100%
    minBrightness: 0.4,     // HSL Lightness minimum (0-1) -> 40%
    maxBrightness: 1.0,     // HSL Lightness maximum (0-1) -> 100%
    brightnessDistanceFactor: 150, // How quickly brightness fades with distance

    // --- Text Sampling ---
    targetText: "初音未来欢迎你",     // Default text if input is empty
    fontSize: 160,            // Base font size (can be adjusted dynamically)
    fontName: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "SimHei", sans-serif', // Font stack
    fontStyle: 'normal',      // 'normal', 'italic', 'bold' etc.
    textSampleColor: '#ffffff', // Color to draw text on temp canvas (must be distinct from bg)
    textSamplingDensity: 2,   // Pixel step for sampling (lower = more points)
    textAlphaThreshold: 128,   // Alpha value threshold (0-255) to consider a pixel part of the text

    // --- Interaction ---
    resetOnClick: true,       // Reset particle positions on click (like Java version)
    timerDelayMs: 16,         // Approximate delay (not directly used with requestAnimationFrame)
};

// --- Global State ---
let particles = [];
let targetPoints = [];
let currentHue = Math.random(); // Start with a random hue (0-1 range)
let centerX = config.width / 2;
let centerY = config.height / 2;

// --- Particle Class ---
class Particle {
    constructor(targets) {
        // Assign a random target point from the list
        if (!targets || targets.length === 0) {
            this.target = { x: centerX, y: centerY }; // Fallback if no points
        } else {
            this.target = targets[Math.floor(Math.random() * targets.length)];
        }

        // Random initial position and velocity
        this.pos = { x: Math.random() * config.width, y: Math.random() * config.height };
        this.vel = { x: (Math.random() - 0.5) * 2, y: (Math.random() - 0.5) * 2 };

        // Random size
        this.size = config.particleMinSize + Math.random() * (config.particleMaxSize - config.particleMinSize);
        this.color = `hsl(0, 0%, 0%)`; // Initial color (will be updated)
    }

    update(hue, center) {
        // --- Attraction Force ---
        const dx = this.target.x - this.pos.x;
        const dy = this.target.y - this.pos.y;
        const distSq = dx * dx + dy * dy;
        if (distSq > 1) { // Avoid division by zero and jitter near target
            const dist = Math.sqrt(distSq);
            // Optional: Limit effect range like in Java (effectiveDist) - Can be less crucial in JS
            // const effectiveDist = Math.min(dist, 200.0);
            const forceMagnitude = config.attractionForce * dist * 0.1; // Simplified force proportional to dist
            this.vel.x += (dx / dist) * forceMagnitude;
            this.vel.y += (dy / dist) * forceMagnitude;
        }

        // --- Swirl Force ---
        if (config.swirlForce !== 0) {
            const dxCenter = this.pos.x - center.x;
            const dyCenter = this.pos.y - center.y;
            const distCenterSq = dxCenter * dxCenter + dyCenter * dyCenter;
            if (distCenterSq > 1) {
                const distCenter = Math.sqrt(distCenterSq);
                this.vel.x += -dyCenter / distCenter * config.swirlForce;
                this.vel.y += dxCenter / distCenter * config.swirlForce;
            }
        }

        // --- Damping ---
        this.vel.x *= config.damping;
        this.vel.y *= config.damping;

        // --- Speed Limits ---
        const speed = Math.sqrt(this.vel.x * this.vel.x + this.vel.y * this.vel.y);
        if (speed > config.particleMaxSpeed) {
            const factor = config.particleMaxSpeed / speed;
            this.vel.x *= factor;
            this.vel.y *= factor;
        } else if (config.particleMinSpeed > 0 && speed < config.particleMinSpeed && distSq < 10000) { // Near target
             if (speed > 0.01) {
                 const factor = config.particleMinSpeed / speed;
                 this.vel.x *= factor;
                 this.vel.y *= factor;
            } else if (distSq > 1){ // If stopped but not at target, give a nudge
                this.vel.x = (Math.random() - 0.5) * config.particleMinSpeed;
                this.vel.y = (Math.random() - 0.5) * config.particleMinSpeed;
            }
        }


        // --- Update Position ---
        this.pos.x += this.vel.x;
        this.pos.y += this.vel.y;

        // --- Update Color (HSL) ---
        const distFromTarget = Math.sqrt(distSq);
        // Convert Java's brightness (0-1) to HSL Lightness (0-100%)
        let lightness = Math.max(config.minBrightness, config.maxBrightness - (distFromTarget / config.brightnessDistanceFactor));
        lightness = Math.min(config.maxBrightness, lightness);

        // Convert global hue (0-1) to degrees (0-360)
        const hueDegrees = (hue * 360) % 360;
        // Convert saturation (0-1) to percentage (0-100)
        const saturationPercent = config.saturation * 100;
        const lightnessPercent = lightness * 100;

        this.color = `hsl(${hueDegrees}, ${saturationPercent}%, ${lightnessPercent}%)`;
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        // Draw circle (equivalent to fillOval)
        ctx.arc(this.pos.x, this.pos.y, this.size / 2, 0, Math.PI * 2);
        ctx.fill();
    }
}

// --- Text Sampling Function ---
// --- Text Sampling Function (处理多行 - 修正版) ---
function getTextPoints(textWithNewlines, fontSize) {
    const points = [];
    const density = config.textSamplingDensity;
    const lines = textWithNewlines.split('\n'); // 按换行符分割成多行

    if (lines.length === 0 || textWithNewlines.trim() === '') {
        console.warn("[getTextPoints] 输入文本为空或无效。");
        return []; // 返回空数组
    }

    // 创建临时画布
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });

    // 设置字体属性
    const font = `${config.fontStyle} ${fontSize}px ${config.fontName}`;
    tempCtx.font = font;

    // --- 计算尺寸 ---
    // 估算单行高度和行距
    // 使用 'M' 或 '字' 这类字符来估算高度通常比直接用 fontSize 更可靠些
    const metrics = tempCtx.measureText("字");
    const approxLineHeight = (metrics.actualBoundingBoxAscent || fontSize) + (metrics.actualBoundingBoxDescent || fontSize * 0.3);
    const leading = approxLineHeight * (config.lineSpacingFactor || 0.3); // 使用行间距因子，如果未定义则默认0.3
    const totalLineHeight = approxLineHeight + leading; // 单行总占高（含行距）

    // 找到最长行的宽度
    let maxWidth = 0;
    lines.forEach(line => {
        // 确保测量时不会因空行导致宽度为0
        maxWidth = Math.max(maxWidth, tempCtx.measureText(line || " ").width);
    });

    // 计算文本块总高度
    const totalBlockHeight = lines.length * approxLineHeight + Math.max(0, lines.length - 1) * leading;

    if (maxWidth <= 0 || totalBlockHeight <= 0) {
        console.error("[getTextPoints] 错误：计算的文本尺寸无效。");
        return null;
    }

    // --- 设置临时画布尺寸 (加上内边距) ---
    // 内边距可以基于字体大小，确保足够空间
    const padding = Math.max(15, fontSize * 0.15);
    tempCanvas.width = Math.ceil(maxWidth) + padding * 2;
    tempCanvas.height = Math.ceil(totalBlockHeight) + padding * 2;
    console.log(`[getTextPoints修正版] 临时画布尺寸: ${tempCanvas.width}x${tempCanvas.height}`);


    // --- 在临时画布上绘制多行文本 ---
    tempCtx.font = font; // 重设字体
    tempCtx.fillStyle = config.textSampleColor;
    tempCtx.textBaseline = 'middle'; // 垂直居中对齐

    // 计算第一行的起始 Y 坐标 (考虑内边距和基线), 目标是让文本块顶部从内边距开始
    const startY = padding + approxLineHeight / 2;
    console.log(`[getTextPoints修正版] 绘制起始 Y: ${startY.toFixed(1)}`);

    lines.forEach((line, index) => {
        const lineWidth = tempCtx.measureText(line).width;
        // ***修正点***：计算 drawX 使当前行在画布内水平居中
        const drawX = (tempCanvas.width - lineWidth) / 2;
        // 计算当前行的 Y 坐标
        const drawY = startY + index * totalLineHeight;
        console.log(`[getTextPoints修正版] 绘制行 ${index}: "${line}" at (${drawX.toFixed(1)}, ${drawY.toFixed(1)})`);
        tempCtx.fillText(line, drawX, drawY);
    });

    // --- 计算偏移量，使整个文本块在主画布居中 ---
    const offsetX = centerX - tempCanvas.width / 2;
    const offsetY = centerY - tempCanvas.height / 2;

    // --- 采样像素点 ---
    try {
        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height).data;
        for (let y = 0; y < tempCanvas.height; y += density) {
            for (let x = 0; x < tempCanvas.width; x += density) {
                const alphaIndex = (y * tempCanvas.width + x) * 4 + 3;
                if (imageData[alphaIndex] > config.textAlphaThreshold) {
                    points.push({ x: x + offsetX, y: y + offsetY });
                }
            }
        }
    } catch (error) {
        console.error("[getTextPoints修正版] 获取图像数据时出错:", error);
        return null;
    }

    if (points.length === 0 && textWithNewlines.trim().length > 0) {
         console.warn("[getTextPoints修正版] 警告：采样到的点数为 0，请检查字体、阈值或绘制逻辑。");
         // 可以在这里添加显示临时画布的调试代码（参考之前的回答）
    } else {
        console.log(`[getTextPoints修正版] 为 "${textWithNewlines.replace('\n', '\\n')}" 采样了 ${points.length} 个目标点。`);
    }

    return points;
}


// --- Reset Particles Function ---
function resetParticles() {
    particles = []; // Clear existing particles
    if (!targetPoints || targetPoints.length === 0) {
        console.warn("No target points available for resetParticles.");
        // Optionally create particles aiming at center as fallback
        // targetPoints = [{ x: centerX, y: centerY }];
        return; // Or just do nothing if no targets
    }
    console.log(`Resetting ${config.numParticles} particles for ${targetPoints.length} targets.`);
    for (let i = 0; i < config.numParticles; i++) {
        particles.push(new Particle(targetPoints)); // Pass the list of targets
    }
}

// --- Update Text Target and Reset ---
// --- Update Text Target and Reset (包含自动换行处理) ---
function updateTextTarget() {
    let rawText = textInput.value || config.targetText; // 获取原始输入或默认文本

    if (!rawText || rawText.trim() === "") {
        rawText = config.targetText;
        textInput.value = rawText; // 如果为空则显示默认文本
        console.log("输入为空，使用默认文本:", rawText);
    }

    // --- 新增：自动换行处理 ---
    let processedText = ''; // 用于存储处理后的文本
    const maxChars = 6;     // 设置每行最大字符数 (这里是 6)

    // 检查是否有需要处理的文本，并且 maxChars > 0
    if (maxChars > 0 && rawText.length > 0) {
        for (let i = 0; i < rawText.length; i += maxChars) {
            // 截取当前行的子字符串 (从 i 到 i + maxChars)
            // Math.min 确保不会超出字符串末尾
            processedText += rawText.substring(i, Math.min(i + maxChars, rawText.length));

            // 如果这不是最后一段文字 (即后面还有字符)，则添加换行符
            if (i + maxChars < rawText.length) {
                processedText += '\n'; // 添加换行符
            }
        }
    } else {
        // 如果不进行换行处理 (maxChars <= 0 或 文本为空)，则直接使用原始文本
        processedText = rawText;
    }
    console.log(`[updateTextTarget] 处理后文本: "${processedText.replace('\n', '\\n')}"`); // 调试信息
    // --- 自动换行处理结束 ---


    // --- （可选）动态字体大小调整 ---
    let dynamicFontSize = config.fontSize; // 使用 config 中的字体大小
    // 你可以根据 processedText 的行数来调整字体大小，如果需要的话
    const numLines = processedText.split('\n').length;
    console.log(`[updateTextTarget] 行数: ${numLines}, 字体大小: ${dynamicFontSize}`);
    // --- 动态字体大小结束 ---


    // 获取新的目标点 (注意：现在传递的是 processedText)
    const newPoints = getTextPoints(processedText, dynamicFontSize);

    if (newPoints && newPoints.length > 0) { // 确保 newPoints 有效且包含点
        targetPoints = newPoints;
        resetParticles();
    } else {
        console.error("[updateTextTarget] 获取文本点失败或没有点被采样。");
        // 考虑是否在此处清空粒子
        // particles = [];
        // targetPoints = [];
    }
}


// --- Resize Canvas Function ---
function resizeCanvas() {
    config.width = canvas.width = window.innerWidth;
    config.height = canvas.height = window.innerHeight;
    centerX = config.width / 2;
    centerY = config.height / 2;
    console.log(`Canvas resized to: ${config.width}x${config.height}`);
    // Resample text and reset particles on resize to fit new center
    updateTextTarget();
}

// --- Animation Loop ---
function animate() {
    // 1. Clear/Trail Effect (Equivalent to background rectangle with alpha)
    ctx.fillStyle = `rgba(0, 0, 0, ${config.trailAlpha})`; // Use config background color with trail alpha
    ctx.fillRect(0, 0, config.width, config.height);

    // 2. Update Hue
    currentHue = (currentHue + config.hueShiftSpeed) % 1.0; // Keep hue in 0-1 range

    // 3. Update and Draw Particles
    // Use a standard for loop for potentially better performance with large arrays
    for (let i = 0; i < particles.length; i++) {
        if (particles[i]) { // Basic check if particle exists
             try {
                particles[i].update(currentHue, { x: centerX, y: centerY });
                particles[i].draw(ctx);
             } catch (updateDrawError) {
                 console.error("Error updating/drawing particle:", updateDrawError, particles[i]);
                 // Optionally remove the problematic particle: particles.splice(i, 1); i--;
             }
        }
    }

    // 4. Request Next Frame
    requestAnimationFrame(animate);
}

// --- Initialization and Event Listeners ---

// Initial setup
resizeCanvas(); // Set initial size and sample default text

// Start animation
animate();

// Event Listeners
window.addEventListener('resize', resizeCanvas);

updateButton.addEventListener('click', () => {
    console.log("Update button clicked.");
    updateTextTarget();
});

textInput.addEventListener('keypress', (event) => {
    if (event.key === 'Enter') {
        console.log("Enter key pressed in input.");
        event.preventDefault(); // Prevent potential form submission if inside one
        updateTextTarget();
    }
});

if (config.resetOnClick) {
    canvas.addEventListener('click', () => {
        console.log("Canvas clicked - resetting particle positions.");
        // Just reset positions, don't resample text
        particles.forEach(p => {
            p.pos = { x: Math.random() * config.width, y: Math.random() * config.height };
            p.vel = { x: (Math.random() - 0.5) * 2, y: (Math.random() - 0.5) * 2 };
        });
    });
}

console.log("Text Particle Vortex Initialized.");
