Overview

CoSpace is an immersive, web-based virtual office built with Meta's Immersive Web SDK (IWSDK) for Quest devices, designed to combat Zoom fatigue by enabling distributed teams to collaborate through natural hand gestures, shared task boards, and AI-driven insights—all while blending virtual presence with real-world awareness via passthrough. This Lifestyle-track entry targets remote workers seeking intuitive, low-pressure teamwork, with an MVP focused on core interactions for a 10-day build.

MVP Description

In CoSpace, users enter a calming 3D office as customizable avatars, seeing teammates in real-time without cameras. They pinch-grab tasks on a Kanban board, swipe to navigate, and toggle passthrough to glance at their real desk. AI transcribes discussions into summaries and auto-creates action items, fostering accountability and wellness. Deployed via GitHub Pages, it's controller-free, accessible, and scalable for 2-4 users, emphasizing 60 FPS performance and <200ms sync latency.

Core Features to Build

Shared Virtual Office: A 20x15ft professional room with desks, soft lighting, and animated windows for a serene, non-distracting environment.

Avatar System: Simple voxel/cartoon avatars with color customization and real-time head/hand tracking, plus idle animations for presence.

Hand Gesture Interactions: Six intuitive gestures (pinch-grab, swipe-navigate, palm-open menu, thumbs-up reactions, two-hand resize, point-direct) with 95% accuracy and tutorial onboarding.

Real-Time Multiplayer: Sync for 2-4 users , with status indicators (active/idle/away) and auto-reconnect.

Task Board Collaboration: 3-column Kanban for drag-drop tasks, voice-to-text comments, and priority coding (red/yellow/green).

Passthrough Integration: Toggle to overlay virtual UI on real room (1080p, 30 FPS), with basic AI scene detection for break suggestions.

AI Meeting Coach: Gemini-powered transcription, auto-summaries emailed post-session, action item creation, and team sentiment analysis (overall mood only).
