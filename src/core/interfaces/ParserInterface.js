/**
 * ParserInterface - 解析器抽象介面
 * 定義所有譜式解析器必須實作的方法
 */

/**
 * 解析器介面定義
 * @interface
 */
export class ParserInterface {
    /**
     * 解析文字輸入為音符陣列
     * @param {string} text - 輸入文字
     * @param {Object} options - 解析選項
     * @returns {Array} - 音符陣列
     */
    parse(text, options = {}) {
        throw new Error('parse() must be implemented by subclass');
    }

    /**
     * 將音符陣列轉換為文字格式
     * @param {Array} notes - 音符陣列
     * @returns {string}
     */
    stringify(notes) {
        throw new Error('stringify() must be implemented by subclass');
    }

    /**
     * 清理/正規化輸入文字
     * @param {string} text
     * @returns {string}
     */
    clean(text) {
        throw new Error('clean() must be implemented by subclass');
    }

    /**
     * 驗證輸入文字格式
     * @param {string} text
     * @returns {boolean}
     */
    validate(text) {
        throw new Error('validate() must be implemented by subclass');
    }

    /**
     * 獲取解析器名稱
     * @returns {string}
     */
    get name() {
        throw new Error('name getter must be implemented by subclass');
    }

    /**
     * 獲取解析器描述
     * @returns {string}
     */
    get description() {
        throw new Error('description getter must be implemented by subclass');
    }
}

export default ParserInterface;
