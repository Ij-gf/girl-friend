(() => {
    const gallery = document.getElementById('gallery');
    const lightbox = document.getElementById('lightbox');
    const lightboxImg = document.getElementById('lightbox-img');
    const lightboxNum = document.getElementById('lightbox-num');
    const cursorLight = document.querySelector('.cursor-light');
    let current = 0;
    const srcs = [];
    let frames = [];
    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let cursorX = mouseX;
    let cursorY = mouseY;

    // ── Render gallery with auto-detect formats ──
    const EXTS = ['jpg', 'jpeg', 'png', 'webp'];
    const TOTAL = 64; // 图片总数

    function tryLoad(img, index, extIndex = 0) {
        if (extIndex >= EXTS.length) return;
        const src = `./public/Q (${index}).${EXTS[extIndex]}`;
        img.onerror = () => tryLoad(img, index, extIndex + 1);
        img.src = src;
        srcs[index - 1] = src; // 预设路径供灯箱使用
    }

    function renderGallery() {
        for (let i = 1; i <= TOTAL; i++) {
            const frame = document.createElement('div');
            frame.className = 'photo-frame';
            frame.dataset.index = i - 1;

            const wrapper = document.createElement('div');
            wrapper.className = 'photo-wrapper';

            const img = document.createElement('img');
            img.alt = `Photo ${i}`;
            img.loading = 'lazy';
            tryLoad(img, i);

            wrapper.appendChild(img);
            frame.appendChild(wrapper);

            const label = document.createElement('span');
            label.className = 'photo-label';
            label.textContent = String(i).padStart(2, '0');
            frame.appendChild(label);

            frame.addEventListener('click', (e) => openLightbox(i - 1, e));
            gallery.appendChild(frame);
            frames.push(frame);
        }

        initScrollReveal();
        init3DTilt();
    }

    renderGallery();

    // ══════════════════════════════════════
    // 1. 光斑背景 - warm bokeh
    // ══════════════════════════════════════
    const canvas = document.getElementById('lightCanvas');
    const ctx = canvas.getContext('2d');
    const spots = [];
    const SPOT_COUNT = 18;

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    class LightSpot {
        constructor() {
            this.reset();
            this.y = Math.random() * canvas.height;
        }
        reset() {
            this.x = Math.random() * canvas.width;
            this.y = canvas.height + 50 + Math.random() * 100;
            this.radius = Math.random() * 80 + 30;
            this.speedY = Math.random() * 0.3 + 0.1;
            this.speedX = (Math.random() - 0.5) * 0.2;
            this.opacity = Math.random() * 0.15 + 0.05;
            const hues = ['212,165,116', '184,160,138', '200,180,150', '220,190,140'];
            this.color = hues[Math.floor(Math.random() * hues.length)];
            this.wobble = Math.random() * Math.PI * 2;
            this.wobbleSpeed = Math.random() * 0.01 + 0.005;
            this.wobbleAmp = Math.random() * 30 + 10;
        }
        update() {
            this.y -= this.speedY;
            this.wobble += this.wobbleSpeed;
            this.x += this.speedX + Math.sin(this.wobble) * 0.3;
            if (this.y < -this.radius * 2) this.reset();
        }
        draw() {
            const wx = this.x + Math.sin(this.wobble) * this.wobbleAmp;
            const grad = ctx.createRadialGradient(wx, this.y, 0, wx, this.y, this.radius);
            grad.addColorStop(0, `rgba(${this.color}, ${this.opacity})`);
            grad.addColorStop(1, `rgba(${this.color}, 0)`);
            ctx.beginPath();
            ctx.arc(wx, this.y, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = grad;
            ctx.fill();
        }
    }

    for (let i = 0; i < SPOT_COUNT; i++) {
        spots.push(new LightSpot());
    }

    function animateSpots() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        spots.forEach(s => { s.update(); s.draw(); });
        requestAnimationFrame(animateSpots);
    }
    animateSpots();

    // ══════════════════════════════════════
    // 2. 鼠标光晕跟随 (lerp smooth)
    // ══════════════════════════════════════
    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
    });

    function animateCursor() {
        cursorX += (mouseX - cursorX) * 0.08;
        cursorY += (mouseY - cursorY) * 0.08;
        cursorLight.style.left = cursorX + 'px';
        cursorLight.style.top = cursorY + 'px';
        requestAnimationFrame(animateCursor);
    }
    animateCursor();

    // ══════════════════════════════════════
    // 3. 滚动入场 (staggered)
    // ══════════════════════════════════════
    function initScrollReveal() {
        const frames = document.querySelectorAll('.photo-frame');
        const frameObs = new IntersectionObserver((entries) => {
            const visible = entries.filter(e => e.isIntersecting);
            visible.forEach((entry, i) => {
                setTimeout(() => {
                    entry.target.classList.add('in-view');
                }, i * 100);
                frameObs.unobserve(entry.target);
            });
        }, { threshold: 0.05, rootMargin: '0px 0px -30px 0px' });
        frames.forEach(f => frameObs.observe(f));
    }

    // ══════════════════════════════════════
    // 4. 3D 倾斜 + 内部图片视差
    // ══════════════════════════════════════
    function init3DTilt() {
    frames.forEach(frame => {
        const img = frame.querySelector('.photo-wrapper img');
        let rafId = null;
        let targetRotateX = 0, targetRotateY = 0;
        let currentRotateX = 0, currentRotateY = 0;
        let targetImgX = 0, targetImgY = 0;
        let currentImgX = 0, currentImgY = 0;

        function lerpLoop() {
            currentRotateX += (targetRotateX - currentRotateX) * 0.1;
            currentRotateY += (targetRotateY - currentRotateY) * 0.1;
            currentImgX += (targetImgX - currentImgX) * 0.08;
            currentImgY += (targetImgY - currentImgY) * 0.08;

            frame.style.transform = `perspective(800px) rotateX(${currentRotateX}deg) rotateY(${currentRotateY}deg) translateY(-8px) scale(1.02)`;
            if (img) {
                img.style.transform = `scale(1.08) translate(${currentImgX}px, ${currentImgY}px)`;
            }

            if (
                Math.abs(targetRotateX - currentRotateX) > 0.01 ||
                Math.abs(targetRotateY - currentRotateY) > 0.01 ||
                Math.abs(targetImgX - currentImgX) > 0.01 ||
                Math.abs(targetImgY - currentImgY) > 0.01
            ) {
                rafId = requestAnimationFrame(lerpLoop);
            } else {
                rafId = null;
            }
        }

        frame.addEventListener('mousemove', (e) => {
            const rect = frame.getBoundingClientRect();
            const x = (e.clientX - rect.left) / rect.width;
            const y = (e.clientY - rect.top) / rect.height;
            targetRotateX = (y - 0.5) * -8;
            targetRotateY = (x - 0.5) * 8;
            targetImgX = (x - 0.5) * -12;
            targetImgY = (y - 0.5) * -12;
            if (!rafId) rafId = requestAnimationFrame(lerpLoop);
        });

        frame.addEventListener('mouseleave', () => {
            targetRotateX = 0;
            targetRotateY = 0;
            targetImgX = 0;
            targetImgY = 0;
            if (!rafId) rafId = requestAnimationFrame(lerpLoop);

            // 回弹动画
            const resetAnim = () => {
                currentRotateX += (0 - currentRotateX) * 0.1;
                currentRotateY += (0 - currentRotateY) * 0.1;
                currentImgX += (0 - currentImgX) * 0.08;
                currentImgY += (0 - currentImgY) * 0.08;
                frame.style.transform = `perspective(800px) rotateX(${currentRotateX}deg) rotateY(${currentRotateY}deg)`;
                if (img) {
                    img.style.transform = `scale(1) translate(${currentImgX}px, ${currentImgY}px)`;
                }
                if (Math.abs(currentRotateX) > 0.01 || Math.abs(currentRotateY) > 0.01) {
                    requestAnimationFrame(resetAnim);
                } else {
                    frame.style.transform = '';
                    if (img) img.style.transform = '';
                    currentRotateX = 0;
                    currentRotateY = 0;
                    currentImgX = 0;
                    currentImgY = 0;
                }
            };
            requestAnimationFrame(resetAnim);
        });
    });
    }

    // ══════════════════════════════════════
    // 5. 滚动视差
    // ══════════════════════════════════════
    let ticking = false;
    window.addEventListener('scroll', () => {
        if (!ticking) {
            requestAnimationFrame(() => {
                ticking = false;
            });
            ticking = true;
        }
    });

    // ══════════════════════════════════════
    // 6. 灯箱 - 从点击位置飞出
    // ══════════════════════════════════════
    function openLightbox(index, event) {
        current = index;
        updateLightbox();

        // 从点击的相框位置展开
        if (event) {
            const frame = frames[index];
            const rect = frame.getBoundingClientRect();
            const stage = document.querySelector('.lightbox-stage');
            const fromX = rect.left + rect.width / 2 - window.innerWidth / 2;
            const fromY = rect.top + rect.height / 2 - window.innerHeight / 2;
            stage.style.transition = 'none';
            stage.style.transform = `translate(${fromX * 0.3}px, ${fromY * 0.3}px) scale(0.6)`;
            stage.style.opacity = '0';
            requestAnimationFrame(() => {
                stage.style.transition = 'transform 0.7s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.5s ease';
                stage.style.transform = 'translate(0, 0) scale(1)';
                stage.style.opacity = '1';
            });
        }

        lightbox.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeLightbox() {
        const stage = document.querySelector('.lightbox-stage');
        stage.style.transform = 'scale(0.9) translateY(20px)';
        stage.style.opacity = '0';
        setTimeout(() => {
            lightbox.classList.remove('active');
            document.body.style.overflow = '';
            stage.style.transition = '';
            stage.style.transform = '';
            stage.style.opacity = '';
        }, 400);
    }

    function updateLightbox() {
        lightboxImg.style.opacity = '0';
        lightboxImg.style.transform = 'scale(0.96)';
        setTimeout(() => {
            // 从 DOM 中获取实际加载成功的图片路径
            const frame = gallery.querySelectorAll('.photo-frame')[current];
            const img = frame ? frame.querySelector('img') : null;
            const src = img && img.src ? img.src : srcs[current];
            lightboxImg.src = src;
            lightboxImg.onload = () => {
                lightboxImg.style.opacity = '1';
                lightboxImg.style.transform = 'scale(1)';
            };
        }, 180);
        lightboxNum.textContent = `${String(current + 1).padStart(2, '0')}`;
    }

    function prev() {
        current = (current - 1 + srcs.length) % srcs.length;
        updateLightbox();
    }

    function next() {
        current = (current + 1) % srcs.length;
        updateLightbox();
    }

    lightbox.querySelector('.lightbox-close').addEventListener('click', closeLightbox);
    lightbox.querySelector('.lightbox-prev').addEventListener('click', prev);
    lightbox.querySelector('.lightbox-next').addEventListener('click', next);
    lightbox.querySelector('.lightbox-overlay').addEventListener('click', closeLightbox);

    document.addEventListener('keydown', (e) => {
        if (!lightbox.classList.contains('active')) return;
        if (e.key === 'Escape') closeLightbox();
        if (e.key === 'ArrowLeft') prev();
        if (e.key === 'ArrowRight') next();
    });

    // Touch swipe
    let touchStartX = 0;
    lightbox.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });
    lightbox.addEventListener('touchend', (e) => {
        const diff = e.changedTouches[0].screenX - touchStartX;
        if (Math.abs(diff) > 50) {
            diff > 0 ? prev() : next();
        }
    }, { passive: true });
})();
