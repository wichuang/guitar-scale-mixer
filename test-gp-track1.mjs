import fs from 'fs';
import { parseTabFile } from 'guitarpro-parser';

const data = fs.readFileSync('/Users/williamchuang/Desktop/Guitar Pro tabs - free pack/GaryMoore/moore-gary-one_day.gp3');
const song = parseTabFile(new Uint8Array(data));

const track = song.tracks[1];
let count = 0;
for (const bar of track.bars) {
    if (count > 2) break;
    console.log(`Bar ${count}:`);
    for (const beat of bar.beats) {
        if (!beat.isRest && beat.notes.length > 0) {
            for (const n of beat.notes) {
                console.log(`    Note: string ${n.string}, fret ${n.fret}`);
            }
        }
    }
    count++;
}
