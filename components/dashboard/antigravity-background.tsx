'use client';

import React, { useEffect, useRef } from 'react';

export default function AntigravityBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let particles: Array<{
      x: number;
      y: number;
      size: number;
      speedY: number;
      speedX: number;
      opacity: number;
      pulseSpeed: number;
      pulseDir: number;
      color: string;
      glowColor: string;
    }> = [];

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // Generate particles based on screen width
    const createParticles = () => {
      particles = [];
      const count = Math.min(Math.floor(window.innerWidth / 18), 70);
      const colors = [
        { rgb: '0, 100, 255', glow: '#0064FF' },    // primary blue
        { rgb: '148, 163, 184', glow: '#94a3b8' },   // slate-400
        { rgb: '100, 116, 139', glow: '#64748b' },   // slate-500
        { rgb: '71, 85, 105', glow: '#475569' }     // slate-600
      ];

      for (let i = 0; i < count; i++) {
        const selectedColor = colors[Math.floor(Math.random() * colors.length)];
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height + canvas.height, // start below or scattered
          size: Math.random() * 2.5 + 1.2,
          speedY: -(Math.random() * 0.4 + 0.15), // slowly floating up (antigravity)
          speedX: (Math.random() - 0.5) * 0.25,
          opacity: Math.random() * 0.4 + 0.15,
          pulseSpeed: Math.random() * 0.015 + 0.005,
          pulseDir: Math.random() > 0.5 ? 1 : -1,
          color: selectedColor.rgb,
          glowColor: selectedColor.glow
        });
      }
    };

    // Initialize particles and spread them across the height
    createParticles();
    particles.forEach(p => {
      p.y = Math.random() * canvas.height;
    });

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((p) => {
        // Update opacity for pulsing effect
        p.opacity += p.pulseSpeed * p.pulseDir;
        if (p.opacity >= 0.6) {
          p.opacity = 0.6;
          p.pulseDir = -1;
        } else if (p.opacity <= 0.1) {
          p.opacity = 0.1;
          p.pulseDir = 1;
        }

        // Update position
        p.y += p.speedY;
        p.x += p.speedX;

        // Reset particle to bottom when it goes off screen
        if (p.y < -10) {
          p.y = canvas.height + 10;
          p.x = Math.random() * canvas.width;
        }
        
        // Bounce off side boundaries
        if (p.x < 0 || p.x > canvas.width) {
          p.speedX *= -1;
        }

        // Draw particle node
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        
        ctx.fillStyle = `rgba(${p.color}, ${p.opacity})`;
        ctx.shadowBlur = p.size * 1.5;
        ctx.shadowColor = p.glowColor;
        ctx.fill();
      });

      // Reset shadow blur for clean line drawing
      ctx.shadowBlur = 0;

      // Draw neural connections between close nodes
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 110) {
            const alpha = (1 - dist / 110) * 0.08;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.lineWidth = 0.45;
            ctx.stroke();
          }
        }
      }

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-0"
    />
  );
}
