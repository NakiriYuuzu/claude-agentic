<template>
    <!-- YuuzuAgent Logo - 極簡現代風格 -->
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none">
        <title>YuuzuAgent</title>

        <!-- 背景圓形 -->
        <circle cx="16" cy="16" r="16" fill="#E97350"/>

        <!-- 對話氣泡 -->
        <path
            d="M10 12 C10 10 11 9 13 9 L19 9 C21 9 22 10 22 12 L22 16 C22 18 21 19 19 19 L17 19 L15 21 L15 19 L13 19 C11 19 10 18 10 16 Z"
            fill="white"
            opacity="0.95"
        />

        <!-- AI 神經連接點 -->
        <circle cx="13" cy="13" r="1" fill="#E97350"/>
        <circle cx="16" cy="13" r="1" fill="#E97350"/>
        <circle cx="19" cy="13" r="1" fill="#E97350"/>

        <!-- 神經連接線 -->
        <path
            d="M13 14.5 Q16 15.5 19 14.5"
            stroke="#E97350"
            stroke-width="0.5"
            fill="none"
        />

        <!-- 外圈裝飾 -->
        <circle
            cx="16"
            cy="16"
            r="14"
            stroke="white"
            stroke-width="0.5"
            fill="none"
            opacity="0.2"
        />
    </svg>
</template>

<style scoped>
.yuuzu-logo {
    color: var(--primary);
    transition: all 0.3s ease;
}

.yuuzu-logo:hover {
    transform: scale(1.05);
}

.logo-icon {
    animation: subtle-pulse 3s ease-in-out infinite;
}

@keyframes subtle-pulse {
    0%, 100% {
        opacity: 1;
    }
    50% {
        opacity: 0.85;
    }
}
</style>
