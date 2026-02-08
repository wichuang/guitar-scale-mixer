/**
 * Score - 樂譜容器類別
 * 包含音符陣列和元數據，支援序列化和自動儲存
 */

import { Note } from './Note.js';

/**
 * 樂譜容器類別
 */
export class Score {
    /**
     * @param {Object} props
     * @param {Array} props.notes - 音符陣列
     * @param {Object} props.metadata - 樂譜元數據
     */
    constructor(props = {}) {
        this._notes = [];
        this.metadata = {
            name: props.metadata?.name ?? 'Untitled Score',
            key: props.metadata?.key ?? 'C',
            scaleType: props.metadata?.scaleType ?? 'Major',
            tempo: props.metadata?.tempo ?? 120,
            timeSignature: props.metadata?.timeSignature ?? '4/4',
            startString: props.metadata?.startString ?? 5,
            octaveOffset: props.metadata?.octaveOffset ?? -1,
            createdAt: props.metadata?.createdAt ?? new Date().toISOString(),
            updatedAt: props.metadata?.updatedAt ?? new Date().toISOString(),
            // Header metadata (from OCR)
            title: props.metadata?.title ?? null,
            capo: props.metadata?.capo ?? null,
            composer: props.metadata?.composer ?? null,
            lyricist: props.metadata?.lyricist ?? null,
            // YouTube 相關
            youtubeUrl: props.metadata?.youtubeUrl ?? '',
            showYoutube: props.metadata?.showYoutube ?? false,
            youtubeLayout: props.metadata?.youtubeLayout ?? { x: 50, y: 50, width: 320, height: 180 },
            // 顯示設定
            viewMode: props.metadata?.viewMode ?? 'both',
            showScaleGuide: props.metadata?.showScaleGuide ?? true,
        };

        // Initialize notes
        if (props.notes) {
            this.setNotes(props.notes);
        }
    }

    /**
     * 獲取音符陣列
     */
    get notes() {
        return this._notes;
    }

    /**
     * 設定音符陣列
     * @param {Array} notes - Note 實例或 plain objects 陣列
     */
    setNotes(notes) {
        this._notes = notes.map((n, idx) => {
            if (n instanceof Note) {
                return n.index !== idx ? n.clone({ index: idx }) : n;
            }
            return Note.fromObject({ ...n, index: idx });
        });
        this.metadata.updatedAt = new Date().toISOString();
    }

    /**
     * 添加音符
     * @param {Note|Object} note
     * @param {number} position - 插入位置，預設在末尾
     */
    addNote(note, position = -1) {
        const newNote = note instanceof Note ? note : Note.fromObject(note);

        if (position < 0 || position >= this._notes.length) {
            newNote.index = this._notes.length;
            this._notes.push(newNote);
        } else {
            this._notes.splice(position, 0, newNote);
            // Re-index
            this._notes.forEach((n, idx) => n.index = idx);
        }
        this.metadata.updatedAt = new Date().toISOString();
    }

    /**
     * 移除音符
     * @param {number} index
     */
    removeNote(index) {
        if (index >= 0 && index < this._notes.length) {
            this._notes.splice(index, 1);
            // Re-index
            this._notes.forEach((n, idx) => n.index = idx);
            this.metadata.updatedAt = new Date().toISOString();
        }
    }

    /**
     * 更新音符
     * @param {number} index
     * @param {Object} updates
     */
    updateNote(index, updates) {
        if (index >= 0 && index < this._notes.length) {
            const note = this._notes[index];
            this._notes[index] = note.clone(updates);
            this.metadata.updatedAt = new Date().toISOString();
        }
    }

    /**
     * 獲取音符數量（不含分隔符）
     */
    get noteCount() {
        return this._notes.filter(n => !n.isSeparator).length;
    }

    /**
     * 獲取總數量
     */
    get length() {
        return this._notes.length;
    }

    /**
     * 轉換為 JSON（向後相容 localStorage 格式）
     * @returns {Object}
     */
    toJSON() {
        return {
            name: this.metadata.name,
            data: {
                text: this.toJianpuString(),
                notes: this._notes.map(n => n.toObject()),
                key: this.metadata.key,
                scaleType: this.metadata.scaleType,
                tempo: this.metadata.tempo,
                timeSignature: this.metadata.timeSignature,
                startString: this.metadata.startString,
                octaveOffset: this.metadata.octaveOffset,
                youtubeUrl: this.metadata.youtubeUrl,
                showYoutube: this.metadata.showYoutube,
                youtubeLayout: this.metadata.youtubeLayout,
                viewMode: this.metadata.viewMode,
                showScaleGuide: this.metadata.showScaleGuide
            }
        };
    }

    /**
     * 從 JSON 創建 Score 實例
     * @param {Object|string} json
     * @returns {Score}
     */
    static fromJSON(json) {
        const data = typeof json === 'string' ? JSON.parse(json) : json;

        // Support both { name, data: {...} } format AND direct data format
        const actualData = data.data ? data.data : data;

        return new Score({
            notes: actualData.notes || [],
            metadata: {
                name: data.name || 'GuitarScore',
                key: actualData.key || 'C',
                scaleType: actualData.scaleType || 'Major',
                tempo: actualData.tempo || 120,
                timeSignature: actualData.timeSignature || '4/4',
                startString: actualData.startString ?? 5,
                octaveOffset: actualData.octaveOffset ?? -1,
                youtubeUrl: actualData.youtubeUrl || '',
                showYoutube: actualData.showYoutube ?? false,
                youtubeLayout: actualData.youtubeLayout || { x: 50, y: 50, width: 320, height: 180 },
                viewMode: actualData.viewMode || 'both',
                showScaleGuide: actualData.showScaleGuide ?? true
            }
        });
    }

    /**
     * 轉換為自動儲存格式
     * @returns {Object}
     */
    toAutosaveFormat() {
        return {
            text: this.toJianpuString(),
            notes: this._notes.map(n => n.toObject()),
            key: this.metadata.key,
            scaleType: this.metadata.scaleType,
            tempo: this.metadata.tempo,
            timeSignature: this.metadata.timeSignature,
            startString: this.metadata.startString,
            octaveOffset: this.metadata.octaveOffset,
            showScaleGuide: this.metadata.showScaleGuide,
            youtubeUrl: this.metadata.youtubeUrl,
            showYoutube: this.metadata.showYoutube,
            youtubeLayout: this.metadata.youtubeLayout,
            viewMode: this.metadata.viewMode
        };
    }

    /**
     * 從自動儲存格式恢復
     * @param {Object} data
     * @returns {Score}
     */
    static fromAutosave(data) {
        if (!data) return new Score();

        return new Score({
            notes: data.notes || [],
            metadata: {
                key: data.key || 'C',
                scaleType: data.scaleType || 'Major',
                tempo: data.tempo || 120,
                timeSignature: data.timeSignature || '4/4',
                startString: data.startString ?? 5,
                octaveOffset: data.octaveOffset ?? -1,
                showScaleGuide: data.showScaleGuide ?? true,
                youtubeUrl: data.youtubeUrl || '',
                showYoutube: data.showYoutube ?? false,
                youtubeLayout: data.youtubeLayout || { x: 50, y: 50, width: 320, height: 180 },
                viewMode: data.viewMode || 'both'
            }
        });
    }

    /**
     * 轉換為簡譜字串
     * @returns {string}
     */
    toJianpuString() {
        return this._notes.map(n => {
            if (n.isSeparator) return '|';
            if (n.isRest) return '0';
            if (n.isExtension) return '-';
            if (n.isSymbol) return n.displayStr;
            if (n.displayStr) return n.displayStr;

            let str = n.jianpu || '';
            if (n.octave === 5) str = str + '.';
            if (n.octave === 6) str = str + '..';
            if (n.octave === 3) str = '_' + str;
            if (n.octave === 2) str = '__' + str;
            if (n.accidentalStr) str += n.accidentalStr;
            return str;
        }).join(' ');
    }

    /**
     * 更新元數據
     * @param {Object} updates
     */
    updateMetadata(updates) {
        Object.assign(this.metadata, updates);
        this.metadata.updatedAt = new Date().toISOString();
    }

    /**
     * 複製此樂譜
     * @returns {Score}
     */
    clone() {
        return new Score({
            notes: this._notes.map(n => n.clone()),
            metadata: { ...this.metadata }
        });
    }
}

export default Score;
