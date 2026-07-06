import { useEffect, useRef, useState } from 'react';
import { useRive, useStateMachineInput } from '@rive-app/react-canvas';
import * as Tone from 'tone';
import { Midi } from '@tonejs/midi';
import { Upload, Music } from 'lucide-react';

function getRiveTriggerForMidiNote(midiNumber: number) {
  let note = midiNumber;
  // Normalize to 24-59 range
  while (note < 24) note += 12;
  while (note > 59) note -= 12;

  if (note >= 24 && note <= 28) return 'C1-E1';
  if (note >= 29 && note <= 35) return 'F1-B1';
  if (note >= 36 && note <= 40) return 'C2-E2';
  if (note >= 41 && note <= 44) return 'F2-G2';
  if (note >= 45 && note <= 47) return 'A2-B2';
  if (note >= 48 && note <= 52) return 'C3-E3';
  if (note >= 53 && note <= 59) return 'F3-B3';

  return 'Middle'; // Fallback
}

function App() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);
  const [loadedMidi, setLoadedMidi] = useState<Midi | null>(null);
  const synthRef = useRef<Tone.PolySynth | null>(null);
  const riveInputsRef = useRef<Record<string, any>>({});

  const loadedMidiRef = useRef(loadedMidi);
  loadedMidiRef.current = loadedMidi;
  
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;
  
  const isWaitingRef = useRef(isWaiting);
  isWaitingRef.current = isWaiting;

  // We define a dummy stopMidiRef here, and update its current later
  const stopMidiRef = useRef<() => void>(() => {});

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const { rive, RiveComponent } = useRive({
    src: '/18845-37092-play-piano-with-my-cat.riv',
    autoplay: true,
    onStateChange: (event) => {
      const states = Array.isArray(event.data) ? event.data : [event.data];
      const joinedStates = states.join(', ');

      if (loadedMidiRef.current) {
        const lower = joinedStates.toLowerCase();
        
        // Start logic
        if (!isPlayingRef.current && !isWaitingRef.current) {
          if (lower.includes('your choice') || lower.includes('piece 4')) {
            setIsWaiting(true);
            setTimeout(() => {
              playMidiRef.current(true);
            }, 3500);
          }
        } 
      }
    }
  });

  useEffect(() => {
    if (rive) {
      const stateMachines = rive.stateMachineNames;
      if (stateMachines && stateMachines.length > 0) {
        rive.play(stateMachines[0]);
        
        const inputs = rive.stateMachineInputs(stateMachines[0]);
        if (inputs) {
          const map: Record<string, any> = {};
          inputs.forEach(i => map[i.name] = i);
          riveInputsRef.current = map;
        }
      }
    }
  }, [rive]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      // Resume AudioContext during user gesture
      await Tone.start();
      
      const arrayBuffer = await file.arrayBuffer();
      const midi = new Midi(arrayBuffer);
      setLoadedMidi(midi);
      if (isPlayingRef.current) {
        stopMidiRef.current();
      }
    } catch (error) {
      console.error("Error parsing MIDI:", error);
      alert("Failed to parse MIDI file.");
    }
  };

  const playMidi = async (isCraftMode = false) => {
    if (!loadedMidi) return;
    
    await Tone.start();
    
    if (!synthRef.current) {
      synthRef.current = new Tone.PolySynth(Tone.Synth, {
        maxPolyphony: 88,
        oscillator: { type: 'sine' },
        envelope: { attack: 0.05, decay: 0.2, sustain: 0.2, release: 1.5 }
      }).toDestination();
    }

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    Tone.Transport.stop();
    Tone.Transport.cancel();
    
    if (loadedMidi.header.tempos.length > 0) {
      Tone.Transport.bpm.value = loadedMidi.header.tempos[0].bpm;
    } else {
      Tone.Transport.bpm.value = 120;
    }

    loadedMidi.tracks.forEach(track => {
      track.notes.forEach(note => {
        Tone.Transport.schedule((time) => {
          synthRef.current?.triggerAttackRelease(note.name, note.duration, time, note.velocity);
          
          const triggerName = getRiveTriggerForMidiNote(note.midi);
          const input = riveInputsRef.current[triggerName];
          if (input) {
            input.fire();
          }
        }, note.time + 0.5);
      });
    });

    setIsPlaying(true);
    setIsWaiting(false);
    Tone.Transport.start();

    // If in craft mode, stop exactly after 10 seconds! Otherwise play full song.
    const duration = isCraftMode === true ? 10 : (loadedMidi.duration + 1);

    timerRef.current = setTimeout(() => {
      stopMidiRef.current();
    }, duration * 1000);
  };

  const stopMidi = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    Tone.Transport.stop();
    Tone.Transport.cancel();
    setIsPlaying(false);
    setIsWaiting(false);
  };
  
  stopMidiRef.current = stopMidi;

  const playMidiRef = useRef(playMidi);
  playMidiRef.current = playMidi;

  return (
    <>
      <div className="bg-bubbles">
        <div className="bubble"></div>
        <div className="bubble"></div>
        <div className="bubble"></div>
        <div className="bubble"></div>
        <div className="bubble"></div>
        <div className="bubble"></div>
        <div className="bubble"></div>
        <div className="bubble"></div>
      </div>
      
      <div className="fullscreen-container">
        <RiveComponent />
      </div>

      <div className="ui-layer">
        <label className="upload-button">
          <Upload size={20} />
          <span>{loadedMidi ? "Change MIDI" : "Upload MIDI"}</span>
          <input 
            type="file" 
            accept=".mid,.midi" 
            onChange={handleFileUpload} 
            className="hidden-input" 
          />
        </label>
        
        {isWaiting && (
          <div className="playing-status" style={{backgroundColor: 'rgba(251, 191, 36, 0.2)', borderColor: 'rgba(251, 191, 36, 0.5)'}}>
            <Music size={16} style={{display: 'inline', marginRight: '5px', verticalAlign: 'middle'}}/>
            Waiting for countdown...
          </div>
        )}

        {loadedMidi && !isPlaying && !isWaiting && (
          <button className="upload-button" onClick={playMidi} style={{backgroundColor: 'rgba(52, 211, 153, 0.2)', borderColor: 'rgba(52, 211, 153, 0.5)'}}>
            <Music size={20} />
            <span>Play Loaded MIDI</span>
          </button>
        )}

        {isPlaying && (
          <button className="upload-button" onClick={stopMidi} style={{backgroundColor: 'rgba(248, 113, 113, 0.2)', borderColor: 'rgba(248, 113, 113, 0.5)'}}>
            <span>Stop</span>
          </button>
        )}
        
        {isPlaying && (
          <div className="playing-status">
            <Music size={16} style={{display: 'inline', marginRight: '5px', verticalAlign: 'middle'}}/>
            Playing...
          </div>
        )}
      </div>
    </>
  );
}

export default App;
