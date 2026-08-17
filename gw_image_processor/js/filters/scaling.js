// scaling.js
// Algorithms for Pixel Art Resampling

// Helper: Check if two pixels are "equal" (can tolerate slight variations if needed, but for pure pixel art, exact match)
function isDiff(d1, d2, tol = 0) {
    if (tol === 0) {
        return d1[0] !== d2[0] || d1[1] !== d2[1] || d1[2] !== d2[2];
    }
    return Math.abs(d1[0] - d2[0]) + Math.abs(d1[1] - d2[1]) + Math.abs(d1[2] - d2[2]) > tol;
}

function getPixel(data, x, y, width, height) {
    if (x < 0) x = 0;
    if (y < 0) y = 0;
    if (x >= width) x = width - 1;
    if (y >= height) y = height - 1;
    let idx = (y * width + x) * 4;
    return [data[idx], data[idx+1], data[idx+2], data[idx+3]];
}

function setPixel(outData, x, y, outWidth, color) {
    let idx = (y * outWidth + x) * 4;
    outData[idx] = color[0];
    outData[idx+1] = color[1];
    outData[idx+2] = color[2];
    outData[idx+3] = color[3];
}

/**
 * Nearest Neighbor 2x Scaling
 */
export function applyNearestNeighbor2x(data, width, height) {
    const outWidth = width * 2;
    const outHeight = height * 2;
    const outData = new Uint8ClampedArray(outWidth * outHeight * 4);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let p = getPixel(data, x, y, width, height);
            setPixel(outData, x * 2, y * 2, outWidth, p);
            setPixel(outData, x * 2 + 1, y * 2, outWidth, p);
            setPixel(outData, x * 2, y * 2 + 1, outWidth, p);
            setPixel(outData, x * 2 + 1, y * 2 + 1, outWidth, p);
        }
    }
    return { data: outData, width: outWidth, height: outHeight };
}

/**
 * Scale2x Algorithm (AdvanceMAME Scale2x)
 */
export function applyScale2x(data, width, height) {
    const outWidth = width * 2;
    const outHeight = height * 2;
    const outData = new Uint8ClampedArray(outWidth * outHeight * 4);

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let P = getPixel(data, x, y, width, height);
            let A = getPixel(data, x, y - 1, width, height);
            let B = getPixel(data, x + 1, y, width, height);
            let C = getPixel(data, x - 1, y, width, height);
            let D = getPixel(data, x, y + 1, width, height);

            let E0 = P, E1 = P, E2 = P, E3 = P;

            if (C[0] === A[0] && C[1] === A[1] && C[2] === A[2] && 
                (C[0] !== D[0] || C[1] !== D[1] || C[2] !== D[2]) && 
                (A[0] !== B[0] || A[1] !== B[1] || A[2] !== B[2])) {
                E0 = A;
            }
            if (A[0] === B[0] && A[1] === B[1] && A[2] === B[2] && 
                (A[0] !== C[0] || A[1] !== C[1] || A[2] !== C[2]) && 
                (B[0] !== D[0] || B[1] !== D[1] || B[2] !== D[2])) {
                E1 = B;
            }
            if (C[0] === D[0] && C[1] === D[1] && C[2] === D[2] && 
                (C[0] !== A[0] || C[1] !== A[1] || C[2] !== A[2]) && 
                (D[0] !== B[0] || D[1] !== B[1] || D[2] !== B[2])) {
                E2 = C;
            }
            if (D[0] === B[0] && D[1] === B[1] && D[2] === B[2] && 
                (D[0] !== C[0] || D[1] !== C[1] || D[2] !== C[2]) && 
                (B[0] !== A[0] || B[1] !== A[1] || B[2] !== A[2])) {
                E3 = D;
            }

            setPixel(outData, x * 2, y * 2, outWidth, E0);
            setPixel(outData, x * 2 + 1, y * 2, outWidth, E1);
            setPixel(outData, x * 2, y * 2 + 1, outWidth, E2);
            setPixel(outData, x * 2 + 1, y * 2 + 1, outWidth, E3);
        }
    }
    return { data: outData, width: outWidth, height: outHeight };
}

/**
 * HQ2x Simplified
 * This uses a tolerance-based color difference to handle slight antialiasing
 * and applies a blending heuristic if diagonal edges are detected.
 */
export function applyHQ2xSimplified(data, width, height) {
    const outWidth = width * 2;
    const outHeight = height * 2;
    const outData = new Uint8ClampedArray(outWidth * outHeight * 4);
    
    // YUV Difference tolerance
    const tol = 30; 

    // Interpolate function (blend two pixels)
    function interp(p1, p2, w1=1, w2=1) {
        return [
            (p1[0]*w1 + p2[0]*w2)/(w1+w2),
            (p1[1]*w1 + p2[1]*w2)/(w1+w2),
            (p1[2]*w1 + p2[2]*w2)/(w1+w2),
            255
        ];
    }

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let P = getPixel(data, x, y, width, height);
            
            // 8 neighbors
            let N1 = getPixel(data, x - 1, y - 1, width, height);
            let N2 = getPixel(data, x, y - 1, width, height);
            let N3 = getPixel(data, x + 1, y - 1, width, height);
            let N4 = getPixel(data, x - 1, y, width, height);
            let N5 = getPixel(data, x + 1, y, width, height);
            let N6 = getPixel(data, x - 1, y + 1, width, height);
            let N7 = getPixel(data, x, y + 1, width, height);
            let N8 = getPixel(data, x + 1, y + 1, width, height);

            let E0 = P, E1 = P, E2 = P, E3 = P;

            // Simple Edge Rules based on color differences
            let d_N2_N4 = isDiff(N2, N4, tol);
            let d_N2_N5 = isDiff(N2, N5, tol);
            let d_N7_N4 = isDiff(N7, N4, tol);
            let d_N7_N5 = isDiff(N7, N5, tol);

            // Top-left pixel E0
            if (!isDiff(N2, N4, tol) && isDiff(N2, P, tol) && isDiff(N4, P, tol)) {
                E0 = interp(N2, P, 1, 1);
            }
            
            // Top-right pixel E1
            if (!isDiff(N2, N5, tol) && isDiff(N2, P, tol) && isDiff(N5, P, tol)) {
                E1 = interp(N2, P, 1, 1);
            }

            // Bottom-left pixel E2
            if (!isDiff(N7, N4, tol) && isDiff(N7, P, tol) && isDiff(N4, P, tol)) {
                E2 = interp(N7, P, 1, 1);
            }

            // Bottom-right pixel E3
            if (!isDiff(N7, N5, tol) && isDiff(N7, P, tol) && isDiff(N5, P, tol)) {
                E3 = interp(N7, P, 1, 1);
            }

            setPixel(outData, x * 2, y * 2, outWidth, E0);
            setPixel(outData, x * 2 + 1, y * 2, outWidth, E1);
            setPixel(outData, x * 2, y * 2 + 1, outWidth, E2);
            setPixel(outData, x * 2 + 1, y * 2 + 1, outWidth, E3);
        }
    }
    return { data: outData, width: outWidth, height: outHeight };
}

/**
 * Scale4x: Simply run Scale2x twice for a much more pronounced effect
 */
export function applyScale4x(data, width, height) {
    let res2x = applyScale2x(data, width, height);
    return applyScale2x(res2x.data, res2x.width, res2x.height);
}

/**
 * HQ4x: Run HQ2x twice
 */
export function applyHQ4x(data, width, height) {
    let res2x = applyHQ2xSimplified(data, width, height);
    return applyHQ2xSimplified(res2x.data, res2x.width, res2x.height);
}
