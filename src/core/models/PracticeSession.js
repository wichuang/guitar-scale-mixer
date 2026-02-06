/**
 * PracticeSession - 練習紀錄模型
 * 追蹤單次練習的各項數據
 */

/**
 * 生成唯一 ID
 */
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

/**
 * 練習紀錄類別
 */
export class PracticeSession {
    /**
     * @param {Object} props - 練習紀錄屬性
     */
    constructor(props = {}) {
        this.id = props.id || generateId();
        this.date = props.date || Date.now();
        this.duration = props.duration || 0; // 秒

        // 樂譜資訊
        this.songId = props.songId || null;
        this.songName = props.songName || 'Untitled';

        // 速度相關
        this.startBpm = props.startBpm || 120;
        this.endBpm = props.endBpm || 120;
        this.maxBpm = props.maxBpm || 120;
        this.targetBpm = props.targetBpm || null;

        // 練習統計
        this.notesPlayed = props.notesPlayed || 0;
        this.loopsCompleted = props.loopsCompleted || 0;
        this.sectionsWorked = props.sectionsWorked || [];

        // 進階指標
        this.accuracyScore = props.accuracyScore || null;

        // 元數據
        this.key = props.key || 'C';
        this.scaleType = props.scaleType || 'Major';
        this.practiceMode = props.practiceMode || 'free'; // 'free', 'speedTrainer', 'loop'
    }

    /**
     * 計算速度進步百分比
     */
    get speedImprovement() {
        if (this.startBpm === 0) return 0;
        return Math.round(((this.endBpm - this.startBpm) / this.startBpm) * 100);
    }

    /**
     * 取得格式化的練習時長
     */
    get formattedDuration() {
        const minutes = Math.floor(this.duration / 60);
        const seconds = this.duration % 60;
        if (minutes === 0) {
            return `${seconds}s`;
        }
        return `${minutes}m ${seconds}s`;
    }

    /**
     * 取得練習日期 (YYYY-MM-DD)
     */
    get dateString() {
        return new Date(this.date).toISOString().split('T')[0];
    }

    /**
     * 更新練習數據
     */
    update(data) {
        Object.assign(this, data);
        return this;
    }

    /**
     * 結束練習並計算最終數據
     */
    finalize(endData = {}) {
        this.duration = endData.duration || this.duration;
        this.endBpm = endData.endBpm || this.endBpm;
        this.maxBpm = Math.max(this.maxBpm, this.endBpm);
        this.notesPlayed = endData.notesPlayed || this.notesPlayed;
        this.loopsCompleted = endData.loopsCompleted || this.loopsCompleted;
        return this;
    }

    /**
     * 轉換為 JSON
     */
    toJSON() {
        return {
            id: this.id,
            date: this.date,
            duration: this.duration,
            songId: this.songId,
            songName: this.songName,
            startBpm: this.startBpm,
            endBpm: this.endBpm,
            maxBpm: this.maxBpm,
            targetBpm: this.targetBpm,
            notesPlayed: this.notesPlayed,
            loopsCompleted: this.loopsCompleted,
            sectionsWorked: this.sectionsWorked,
            accuracyScore: this.accuracyScore,
            key: this.key,
            scaleType: this.scaleType,
            practiceMode: this.practiceMode
        };
    }

    /**
     * 從 JSON 建立實例
     */
    static fromJSON(json) {
        return new PracticeSession(json);
    }
}

export default PracticeSession;
