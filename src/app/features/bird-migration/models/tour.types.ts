/**
 * Guided Tour Type Definitions
 * TypeScript interfaces for the Arctic Tern narrative tour experience
 *
 * @module tour.types
 * @description Defines guided tour, narrative hotspots, and camera animations
 */

import { MigrationPath } from './migration.types';

/**
 * Complete guided tour definition
 */
export interface GuidedTour {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly speciesKey: number; // GBIF taxon key
  readonly scientificName: string;
  readonly commonName: string;
  readonly migrationPath: MigrationPath;
  readonly narrative: TourNarrative;
  readonly camera: CameraSequence;
  readonly duration: number; // milliseconds
  readonly autoPlay: boolean;
  readonly metadata: TourMetadata;
}

/**
 * Tour narrative with story beats
 */
export interface TourNarrative {
  readonly introduction: NarrativeSection;
  readonly chapters: readonly NarrativeChapter[];
  readonly conclusion: NarrativeSection;
  readonly hotspots: readonly NarrativeHotspot[];
}

/**
 * Narrative section (intro/conclusion)
 */
export interface NarrativeSection {
  readonly title: string;
  readonly content: string;
  readonly duration: number; // milliseconds
  readonly voiceover?: AudioAsset;
  readonly backgroundMusic?: AudioAsset;
}

/**
 * Story chapter in the tour
 */
export interface NarrativeChapter {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly startTime: number; // milliseconds from tour start
  readonly duration: number; // milliseconds
  readonly location: GeographicLocation;
  readonly hotspots: readonly string[]; // Hotspot IDs
  readonly cameraKeyframes: readonly CameraKeyframe[];
  readonly facts: readonly string[];
  readonly images?: readonly ImageAsset[];
}

/**
 * Interactive narrative hotspot marker
 */
export interface NarrativeHotspot {
  readonly id: string;
  readonly chapterId: string;
  readonly position: GeographicLocation;
  readonly appearTime: number; // milliseconds from tour start
  readonly disappearTime: number; // milliseconds from tour start
  readonly content: HotspotContent;
  readonly interaction: HotspotInteraction;
  readonly visual: HotspotVisual;
}

/**
 * Hotspot content data
 */
export interface HotspotContent {
  readonly title: string;
  readonly description: string;
  readonly facts: readonly string[];
  readonly images?: readonly ImageAsset[];
  readonly links?: readonly ExternalLink[];
  readonly scienceFact?: string;
  readonly conservationNote?: string;
}

/**
 * Hotspot interaction behavior
 */
export interface HotspotInteraction {
  readonly clickable: boolean;
  readonly hoverable: boolean;
  readonly autoOpen: boolean;
  readonly pauseTourOnOpen: boolean;
  readonly duration: number; // milliseconds for auto-close
}

/**
 * Hotspot visual appearance
 */
export interface HotspotVisual {
  readonly icon: string; // Icon identifier or emoji
  readonly color: string; // Hex color code
  readonly scale: number; // Size multiplier
  readonly pulseAnimation: boolean;
  readonly glowEffect: boolean;
  readonly labelPosition: 'above' | 'below' | 'left' | 'right';
  readonly zIndex: number;
}

/**
 * Geographic location (lat/lng/alt)
 */
export interface GeographicLocation {
  readonly latitude: number; // -90 to 90
  readonly longitude: number; // -180 to 180
  readonly altitude?: number; // meters above surface (for camera)
}

/**
 * Camera animation sequence
 */
export interface CameraSequence {
  readonly keyframes: readonly CameraKeyframe[];
  readonly defaultSettings: CameraSettings;
  readonly transitions: readonly CameraTransition[];
}

/**
 * Camera keyframe for animation
 */
export interface CameraKeyframe {
  readonly id: string;
  readonly time: number; // milliseconds from sequence start
  readonly position: CameraPosition;
  readonly target: GeographicLocation; // Look-at point
  readonly settings: Partial<CameraSettings>;
  readonly easing: EasingFunction;
}

/**
 * Camera position in 3D space
 */
export interface CameraPosition {
  readonly latitude: number;
  readonly longitude: number;
  readonly distance: number; // Distance from globe center
  readonly elevation: number; // Angle above horizon (degrees)
  readonly azimuth: number; // Rotation around target (degrees)
}

/**
 * Camera settings (FOV, near/far planes, etc.)
 */
export interface CameraSettings {
  readonly fov: number; // Field of view in degrees
  readonly near: number; // Near clipping plane
  readonly far: number; // Far clipping plane
  readonly lookAtSmooth: boolean;
  readonly orbitEnabled: boolean;
  readonly zoomEnabled: boolean;
  readonly panEnabled: boolean;
}

/**
 * Camera transition between keyframes
 */
export interface CameraTransition {
  readonly fromKeyframeId: string;
  readonly toKeyframeId: string;
  readonly duration: number; // milliseconds
  readonly easing: EasingFunction;
  readonly bezierPoints?: readonly [number, number, number, number]; // Cubic bezier control points
}

/**
 * Easing function types
 */
export type EasingFunction =
  | 'linear'
  | 'easeInQuad'
  | 'easeOutQuad'
  | 'easeInOutQuad'
  | 'easeInCubic'
  | 'easeOutCubic'
  | 'easeInOutCubic'
  | 'easeInQuart'
  | 'easeOutQuart'
  | 'easeInOutQuart'
  | 'easeInQuint'
  | 'easeOutQuint'
  | 'easeInOutQuint'
  | 'easeInSine'
  | 'easeOutSine'
  | 'easeInOutSine'
  | 'easeInExpo'
  | 'easeOutExpo'
  | 'easeInOutExpo'
  | 'easeInCirc'
  | 'easeOutCirc'
  | 'easeInOutCirc'
  | 'custom';

/**
 * Tour metadata
 */
export interface TourMetadata {
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly author: string;
  readonly version: string;
  readonly difficulty: 'beginner' | 'intermediate' | 'advanced';
  readonly estimatedDuration: number; // milliseconds
  readonly ageRating: string; // e.g., "All Ages", "8+"
  readonly tags: readonly string[];
  readonly language: string; // ISO 639-1 code
  readonly accessibility: AccessibilityFeatures;
  readonly educational: boolean;
  readonly scientificAccuracy: number; // 0-100 score
}

/**
 * Accessibility features
 */
export interface AccessibilityFeatures {
  readonly closedCaptions: boolean;
  readonly audioDescription: boolean;
  readonly reducedMotion: boolean;
  readonly highContrast: boolean;
  readonly keyboardNavigation: boolean;
  readonly screenReaderOptimized: boolean;
}

/**
 * Audio asset reference
 */
export interface AudioAsset {
  readonly id: string;
  readonly url: string;
  readonly duration: number; // milliseconds
  readonly format: 'mp3' | 'ogg' | 'wav' | 'aac';
  readonly transcription?: string;
  readonly language?: string;
  readonly volume: number; // 0-1
  readonly loop: boolean;
}

/**
 * Image asset reference
 */
export interface ImageAsset {
  readonly id: string;
  readonly url: string;
  readonly thumbnailUrl?: string;
  readonly alt: string;
  readonly caption?: string;
  readonly credit?: string;
  readonly license?: string;
  readonly width: number;
  readonly height: number;
  readonly format: 'jpg' | 'png' | 'webp' | 'svg';
}

/**
 * External link
 */
export interface ExternalLink {
  readonly url: string;
  readonly title: string;
  readonly description?: string;
  readonly icon?: string;
  readonly type:
    | 'website'
    | 'wikipedia'
    | 'research'
    | 'conservation'
    | 'other';
}

/**
 * Tour playback state
 */
export interface TourPlaybackState {
  readonly isActive: boolean;
  readonly isPlaying: boolean;
  readonly currentTime: number; // milliseconds from start
  readonly duration: number; // total tour duration
  readonly currentChapter: string | null; // Chapter ID
  readonly activeHotspots: readonly string[]; // Hotspot IDs
  readonly speed: PlaybackSpeed;
  readonly volume: number; // 0-1
  readonly muted: boolean;
  readonly loop: boolean;
  readonly progress: number; // 0-1
}

/**
 * Playback speed options
 */
export type PlaybackSpeed = 0.5 | 0.75 | 1 | 1.25 | 1.5 | 2;

/**
 * Tour control actions
 */
export type TourAction =
  | 'play'
  | 'pause'
  | 'stop'
  | 'seekTo'
  | 'skipChapter'
  | 'previousChapter'
  | 'nextChapter'
  | 'toggleHotspot'
  | 'setSpeed'
  | 'setVolume'
  | 'toggleMute'
  | 'toggleLoop'
  | 'restart';

/**
 * Tour event types
 */
export type TourEvent =
  | 'tourStarted'
  | 'tourEnded'
  | 'tourPaused'
  | 'tourResumed'
  | 'chapterStarted'
  | 'chapterEnded'
  | 'hotspotShown'
  | 'hotspotHidden'
  | 'hotspotClicked'
  | 'cameraKeyframeReached'
  | 'narrationStarted'
  | 'narrationEnded'
  | 'error';

/**
 * Tour event data
 */
export interface TourEventData {
  readonly event: TourEvent;
  readonly timestamp: number;
  readonly data?: unknown;
  readonly tourId: string;
}

/**
 * Tour configuration options
 */
export interface TourConfig {
  readonly autoStart: boolean;
  readonly showControls: boolean;
  readonly allowSkipping: boolean;
  readonly allowSeeking: boolean;
  readonly allowSpeedControl: boolean;
  readonly showProgress: boolean;
  readonly showChapterMarkers: boolean;
  readonly enableAnalytics: boolean;
  readonly analyticsCallback?: (event: TourEventData) => void;
  readonly onComplete?: () => void;
  readonly onError?: (error: Error) => void;
}

/**
 * Preloaded tour package for offline use
 */
export interface TourPackage {
  readonly tour: GuidedTour;
  readonly assets: {
    readonly audio: readonly AudioAsset[];
    readonly images: readonly ImageAsset[];
  };
  readonly checksum: string;
  readonly version: string;
  readonly sizeBytes: number;
  readonly lastUpdated: Date;
}

/**
 * Simple camera state for JSON keyframes
 */
export interface SimpleCameraState {
  readonly latitude: number;
  readonly longitude: number;
  readonly distance: number;
  readonly azimuth: number;
  readonly elevation: number;
  readonly fov: number;
}

/**
 * Simple keyframe for JSON format
 */
export interface SimpleKeyframe {
  readonly id: string;
  readonly timestamp: number;
  readonly camera: SimpleCameraState;
  readonly pathProgress: number;
  readonly displayHotspots: readonly string[];
}

/**
 * Simple transition for JSON format
 */
export interface SimpleTransition {
  readonly from: string;
  readonly to: string;
  readonly duration: number;
  readonly easing: string;
}

/**
 * Simple hotspot for JSON format
 */
export interface SimpleHotspot {
  readonly id: string;
  readonly position: {
    readonly latitude: number;
    readonly longitude: number;
  };
  readonly title: string;
  readonly description: string;
  readonly facts?: readonly string[];
  readonly appearTime: number;
  readonly disappearTime: number;
}

/**
 * Bird sprite configuration
 */
export interface BirdSpriteConfig {
  readonly size: number;
  readonly color: string;
  readonly opacity: number;
  readonly animationSpeed: number;
}

/**
 * Hotspot marker configuration
 */
export interface HotspotMarkerConfig {
  readonly radius: number;
  readonly color: string;
  readonly pulseSpeed: number;
  readonly glowIntensity: number;
}

/**
 * Simple tour JSON format (used by arctic-tern-tour.json)
 * This is the actual format used in the tour JSON files
 */
export interface SimpleTourJSON {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly species: {
    readonly commonName: string;
    readonly scientificName: string;
    readonly gbifKey: number;
    readonly conservationStatus: string;
    readonly funFacts: readonly string[];
  };
  readonly estimatedDuration: number;
  readonly totalDistance: number;
  readonly keyframes: readonly SimpleKeyframe[];
  readonly transitions: readonly SimpleTransition[];
  readonly hotspots?: readonly SimpleHotspot[];
  readonly pathConfig?: {
    readonly style: string;
    readonly color: string;
    readonly opacity: number;
    readonly tubeRadius: number;
    readonly glowIntensity: number;
    readonly showStartMarker: boolean;
    readonly showEndMarker: boolean;
  };
  readonly birdSpriteConfig?: BirdSpriteConfig;
  readonly hotspotMarkerConfig?: HotspotMarkerConfig;
}
