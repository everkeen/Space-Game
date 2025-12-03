// Check if browser is Safari on iOS < 16.4
const isUnsupported = (): boolean => {
    const userAgent = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(userAgent);
    const isSafari = /Safari/.test(userAgent) && !/Chrome|CriOS|FxiOS/.test(userAgent);
    
    if (isIOS && isSafari) {
        const match = userAgent.match(/OS (\d+)_(\d+)/);
        if (match) {
            const majorVersion = parseInt(match[1], 10);
            const minorVersion = parseInt(match[2], 10);
            const version = majorVersion + minorVersion / 10;
            
            if (version < 16.4) {
                return true;
            }
        }
    }
    
    return false;
};

// Redirect if unsupported
if (isUnsupported()) {
    window.location.href = 'unsupported.html';
}