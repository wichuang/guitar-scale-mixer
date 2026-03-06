/**
 * cvUtils.js - Wrapper utilities for OpenCV.js operations
 * These functions safely wrap OpenCV calls and handle Mat memory management.
 */

/**
 * Convert HTML Canvas ImageData to OpenCV Mat (RGBA)
 * @param {ImageData} imageData 
 * @returns {any} cv.Mat
 */
export function imageDataToMat(imageData) {
    if (!window.cv) throw new Error("OpenCV not loaded");
    const mat = window.cv.matFromArray(imageData.height, imageData.width, window.cv.CV_8UC4, imageData.data);
    return mat;
}

/**
 * Convert OpenCV Mat (any format) back to Canvas ImageData (RGBA)
 * @param {any} mat cv.Mat 
 * @returns {ImageData}
 */
export function matToImageData(mat) {
    if (!window.cv) throw new Error("OpenCV not loaded");

    // Ensure we are in RGBA format for ImageData
    let rgbaMat = new window.cv.Mat();
    if (mat.type() === window.cv.CV_8UC1) {
        window.cv.cvtColor(mat, rgbaMat, window.cv.COLOR_GRAY2RGBA);
    } else if (mat.type() === window.cv.CV_8UC3) {
        window.cv.cvtColor(mat, rgbaMat, window.cv.COLOR_RGB2RGBA);
    } else if (mat.type() === window.cv.CV_8UC4) {
        mat.copyTo(rgbaMat); // already RGBA
    } else {
        rgbaMat.delete();
        throw new Error(`Unsupported Mat type for image data: ${mat.type()}`);
    }

    const imgData = new ImageData(
        new Uint8ClampedArray(rgbaMat.data),
        rgbaMat.cols,
        rgbaMat.rows
    );

    rgbaMat.delete();
    return imgData;
}

/**
 * Convert ImageData to Grayscale
 * @param {ImageData} imageData 
 * @returns {ImageData}
 */
export function cvGrayscale(imageData) {
    if (!window.cv) throw new Error("OpenCV not loaded");
    const src = imageDataToMat(imageData);
    const dst = new window.cv.Mat();

    window.cv.cvtColor(src, dst, window.cv.COLOR_RGBA2GRAY);

    const result = matToImageData(dst);
    src.delete();
    dst.delete();
    return result;
}

/**
 * Apply Gaussian Blur
 * @param {ImageData} imageData 
 * @param {number} radius Typical values: 1, 3, 5
 * @returns {ImageData}
 */
export function cvGaussianBlur(imageData, radius = 1) {
    if (!window.cv) throw new Error("OpenCV not loaded");
    const src = imageDataToMat(imageData);
    const dst = new window.cv.Mat();

    const ksize = radius * 2 + 1; // Must be odd
    const size = new window.cv.Size(ksize, ksize);
    window.cv.GaussianBlur(src, dst, size, 0, 0, window.cv.BORDER_DEFAULT);

    const result = matToImageData(dst);
    src.delete();
    dst.delete();
    return result;
}

/**
 * Global thresholding (Otsu)
 * @param {ImageData} imageData 
 * @returns {ImageData}
 */
export function cvBinarize(imageData) {
    if (!window.cv) throw new Error("OpenCV not loaded");
    const src = imageDataToMat(imageData);
    const gray = new window.cv.Mat();
    const dst = new window.cv.Mat();

    // Ensure grayscale first
    if (src.channels() === 4) {
        window.cv.cvtColor(src, gray, window.cv.COLOR_RGBA2GRAY);
    } else {
        src.copyTo(gray);
    }

    // Otsu's thresholding
    window.cv.threshold(gray, dst, 0, 255, window.cv.THRESH_BINARY | window.cv.THRESH_OTSU);

    const result = matToImageData(dst);
    src.delete();
    gray.delete();
    dst.delete();
    return result;
}

/**
 * Apply Morphological Opening (Remove noise)
 * @param {ImageData} imageData 
 * @param {number} radius Kernel size
 * @returns {ImageData}
 */
export function cvMorphologicalOpen(imageData, radius = 1) {
    if (!window.cv) throw new Error("OpenCV not loaded");
    const src = imageDataToMat(imageData);
    const dst = new window.cv.Mat();

    const ksize = radius * 2 + 1;
    const M = window.cv.Mat.ones(ksize, ksize, window.cv.CV_8U);
    const anchor = new window.cv.Point(-1, -1);

    window.cv.morphologyEx(src, dst, window.cv.MORPH_OPEN, M, anchor, 1, window.cv.BORDER_CONSTANT, window.cv.morphologyDefaultBorderValue());

    const result = matToImageData(dst);
    src.delete();
    dst.delete();
    M.delete();
    return result;
}
