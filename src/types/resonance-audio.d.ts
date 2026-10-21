declare module 'resonance-audio' {
    class ResonanceAudio {
        constructor(context: AudioContext, options?: { ambisonicOrder?: number });
        output: AudioNode;
        setRoomProperties(dimensions: object, materials: object): void;
        createSource(): { input: AudioNode; setPosition(x: number, y: number, z: number): void };
        setListenerFromMatrix(matrix: { elements: ArrayLike<number> }): void;
    }
    export = ResonanceAudio;
}
