// AudioEngine.js
import { el } from "https://cdn.jsdelivr.net/npm/@elemaudio/core@4.0.0-alpha.6/+esm";
import WebRenderer from "https://cdn.jsdelivr.net/npm/@elemaudio/web-renderer@4.0.0-alpha.6/+esm";
import { AUDIO_CONFIG } from "./config.js";

export class AudioEngine {
    static instance = null;

    constructor() {
        this.core = new WebRenderer();
        this.ctx = new AudioContext();
        this.initializePromise = null;
        this.isInitialized = false;
    }

    async initialize() {
        if (!this.initializePromise) {
            this.initializePromise = this._initialize();
        }
        return this.initializePromise;
    }

    async _initialize() {
        try {
            await this.ctx.resume();
            const node = await this.core.initialize(this.ctx, {
                numberOfInputs: 0,
                numberOfOutputs: 1,
                outputChannelCount: [2],
            });
            node.connect(this.ctx.destination);
            this.isInitialized = true;
            console.log("Audio engine initialized and connected");
        } catch (error) {
            console.error("Failed to initialize audio engine:", error);
            throw error;
        }
    }

    renderSynthVoice({ key, freq, gate, velocity }) {
        // Smooth the gate signal to prevent clicks
        const smoothGate = el.smooth(
            0.005,
            el.const({ key: `${key}:smoothGate`, value: gate }),
        );

        // Create an ADSR envelope
        const { attack, decay, sustain, release } = AUDIO_CONFIG.ADSR_SETTINGS;
        const env = el.adsr(attack, decay, sustain, release, smoothGate);

        // Generate a subtle detuning effect
        const detune = el.add(
            el.mul(el.noise(), 0.01), // Random noise for slight pitch variation
            el.mul(el.cycle(0.1), 0.2), // Slow LFO for subtle pitch modulation
        );

        // Create three slightly detuned oscillators for a richer sound
        const osc1 = el.cycle(el.mul(freq, el.add(1, el.mul(detune, 0.001))));
        const osc2 = el.cycle(freq);
        const osc3 = el.cycle(el.mul(freq, el.add(1, el.mul(detune, -0.001))));

        // Mix the oscillators
        const oscMix = el.add(
            el.mul(osc1, 0.33),
            el.mul(osc2, 0.34),
            el.mul(osc3, 0.33),
        );

        // Apply soft saturation for a warmer tone
        const saturated = el.tanh(el.mul(oscMix, 1.5));

        // Create a dynamic lowpass filter
        const cutoff = el.add(el.mul(env, 2000), 100); // Envelope-controlled cutoff
        const resonance = el.add(0.5, el.mul(env, 0.3)); // Slight envelope-controlled resonance
        const filtered = el.svf({ mode: "lowpass" }, cutoff, resonance, saturated);

        // Apply a highpass filter to remove unwanted low frequencies
        const highpassed = el.highpass(160, 0.8, filtered);

        // Combine the envelope, velocity, and filtered signal
        const output = el.mul(
            highpassed,
            env,
            el.const({ key: `${key}:velocity`, value: velocity }),
        );

        // Apply final gain adjustment
        return el.mul(output, 0.8);
    }

    render(outputs) {
        if (!this.isInitialized) {
            console.warn("AudioEngine not initialized. Call initialize() first.");
            return;
        }

        if (outputs.length > 0) {
            const combinedOutput = el.add(...outputs);
            const gainReduction = el.div(
                1,
                el.sqrt(el.const({ key: "voiceCount", value: outputs.length })),
            );
            const limitedOutput = el.tanh(el.mul(combinedOutput, gainReduction, 1.2));

            this.core.render(limitedOutput, limitedOutput);
        } else {
            this.core.render(el.const({ value: 0 }), el.const({ value: 0 }));
        }
    }
}
