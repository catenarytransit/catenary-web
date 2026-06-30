export function getOptimalPixelRatio() {
    const nativeRatio = window.devicePixelRatio || 1;

    const cores = navigator.hardwareConcurrency || 4;
    const memory = (navigator as any).deviceMemory || 4;

    let isWeakGPU = false;
    let isStrongGPU = false;
    let renderer = '';
    let vendor = '';

    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (gl) {
            renderer = (gl.getParameter(gl.RENDERER) || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            vendor = (gl.getParameter(gl.VENDOR) || '').toLowerCase().replace(/[^a-z0-9]/g, '');

            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
            if (debugInfo) {
                const rawUnmaskedRenderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || '';
                const rawUnmaskedVendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || '';

                if (rawUnmaskedRenderer) {
                    renderer += ' ' + rawUnmaskedRenderer.toLowerCase().replace(/[^a-z0-9]/g, '');
                }
                if (rawUnmaskedVendor) {
                    vendor += ' ' + rawUnmaskedVendor.toLowerCase().replace(/[^a-z0-9]/g, '');
                }
            }

            // Match against normalized signatures
            if (
                renderer.includes('intelhd') ||
                renderer.includes('inteluhd') ||
                renderer.includes('swiftshader') ||
                renderer.includes('llvmpipe') ||
                renderer.includes('malit') ||
                renderer.includes('adreno3') // Older mobile/Chromebook ARM chips
            ) {
                isWeakGPU = true;
            }

            if (
                renderer.includes('nvidia') ||
                renderer.includes('geforce') ||
                renderer.includes('rtx') ||
                renderer.includes('gtx') ||
                renderer.includes('radeon') ||
                renderer.includes('amd') ||
                renderer.includes('apple') ||
                vendor.includes('nvidia') ||
                vendor.includes('amd') ||
                vendor.includes('apple')
            ) {
                isStrongGPU = true;
            }
        }
    } catch (e) {
        console.warn('WebGL hardware detection failed:', e);
    }

    console.log("getOptimalPixelRatio Debug:", {
        nativeRatio,
        cores,
        memory,
        isWeakGPU,
        isStrongGPU,
        renderer,
        vendor
    });

    if (isWeakGPU) {
        console.log("PixelRatio result: returning 1 (Weak GPU)");
        return 1;
    }

    if (isStrongGPU) {
        const result = nativeRatio * 2.5;
        console.log(`PixelRatio result: returning ${result} (Strong GPU)`);
        return result;
    }

    if (cores <= 2 || memory <= 2) {
        console.log("PixelRatio result: returning 1 (Low cores/memory on unknown GPU)");
        return 1;
    }

    const result = nativeRatio * 1.5;
    console.log(`PixelRatio result: returning ${result}`);
    return result;
}