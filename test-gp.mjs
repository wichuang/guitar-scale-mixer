import fs from 'fs';
import { parseTabFile } from 'guitarpro-parser';

const data = fs.readFileSync('/Users/williamchuang/Desktop/Guitar Pro tabs - free pack/GaryMoore/moore-gary-one_day.gp3');
const song = parseTabFile(new Uint8Array(data));

console.log(`Title: ${song.title}`);
console.log(`Tracks: ${song.tracks.length}`);
for (let i = 0; i < song.tracks.length; i++) {
    const track = song.tracks[i];
    console.log(`Track ${i}: ${track.name}, string count: ${track.tuningMidi.length}, tuning: ${track.tuningMidi}`);
}

const track = song.tracks[0];
let count = 0;
for (const bar of track.bars) {
    if (count > 2) break;
    console.log(`Bar ${count}:`);
    for (const beat of bar.beats) {
        if (!beat.isRest && beat.notes.length > 0) {
            for (const n of beat.notes) {
                console.log(`    Note: string ${n.string}, fret ${n.fret}`);
            }
        } else if (beat.isRest) {
            console.log(`    Rest`);
        }
    }
    count++;
}
