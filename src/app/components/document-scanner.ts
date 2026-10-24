import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  output,
  signal,
  ViewChild,
} from '@angular/core';
import {MatIconModule} from '@angular/material/icon';
import {ApiService} from '../services/api.service';
import {
  ProfileStorageService,
  SavedAcademicDocument,
} from '../services/storage.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-academic-document-scanner',
  imports: [MatIconModule],
  template: `
    <div class="space-y-6">
      <!-- Scanner & Interactive Cropper Card -->
      <section
        aria-labelledby="scanner-studio-heading"
        class="rounded-2xl border border-slate-200 bg-white p-6 space-y-6 shadow-xs dark:border-slate-800 dark:bg-slate-900"
      >
        <div class="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
          <div class="space-y-1">
            <div class="flex flex-wrap items-center gap-2 text-xs font-semibold text-teal-700 dark:text-teal-400">
              <mat-icon class="!w-4 !h-4 !text-[16px]">document_scanner</mat-icon>
              <span>Device Camera Scanner & Interactive Cropper</span>
              <span aria-hidden="true">·</span>
              <span class="font-normal text-slate-500 dark:text-slate-400">
                100% On-Device Browser Processing
              </span>
            </div>
            <h2 id="scanner-studio-heading" class="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">
              Scan & Crop Academic Documents (Marksheets, Admit Cards & Certificates)
            </h2>
            <p class="text-xs text-slate-600 dark:text-slate-400">
              Use your device camera to capture Class 10/12 marksheets, JEE/CET admit cards, or category certificates, crop out background edges, apply high-contrast document enhancement, and save to your Document Manager.
            </p>
          </div>

          <!-- Camera Action Buttons -->
          <div class="flex flex-wrap items-center gap-2">
            @if (!cameraActive()) {
              <button
                type="button"
                (click)="startCamera()"
                class="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-indigo-700 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-800 transition-colors cursor-pointer"
              >
                <mat-icon class="!w-4 !h-4 !text-[16px]">photo_camera</mat-icon>
                <span>Open Device Camera</span>
              </button>
            } @else {
              <button
                type="button"
                (click)="switchCameraFacing()"
                class="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 cursor-pointer"
              >
                <mat-icon class="!w-4 !h-4 !text-[16px]">flip_camera_ios</mat-icon>
                <span>Flip Camera ({{ facingMode() === 'environment' ? 'Rear' : 'Front' }})</span>
              </button>
              <button
                type="button"
                (click)="stopCamera()"
                class="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-red-300 bg-red-50 px-3.5 py-2 text-xs font-semibold text-red-800 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/60 dark:text-red-200 cursor-pointer"
              >
                <mat-icon class="!w-4 !h-4 !text-[16px]">videocam_off</mat-icon>
                <span>Stop Camera</span>
              </button>
            }

            <button
              type="button"
              (click)="generateSampleAcademicDoc('marksheet')"
              class="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
            >
              <mat-icon class="!w-4 !h-4 !text-[16px]">description</mat-icon>
              <span>Sample Marksheet</span>
            </button>

            <button
              type="button"
              (click)="generateSampleAcademicDoc('admitcard')"
              class="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
            >
              <mat-icon class="!w-4 !h-4 !text-[16px]">badge</mat-icon>
              <span>Sample Admit Card</span>
            </button>
          </div>
        </div>

        @if (cameraError()) {
          <div class="rounded-xl border border-amber-300 bg-amber-50/80 p-3.5 text-xs text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200 flex items-start gap-2.5">
            <mat-icon class="!w-4 !h-4 !text-[16px] text-amber-700 dark:text-amber-400 shrink-0 mt-0.5">warning_amber</mat-icon>
            <div>
              <strong>Camera Notice:</strong> {{ cameraError() }} You can also upload an image file below or click <strong>Sample Marksheet</strong> / <strong>Sample Admit Card</strong> to test the interactive cropper and Document Manager.
            </div>
          </div>
        }

        <!-- Live Camera Viewfinder (When Active) -->
        @if (cameraActive()) {
          <div class="rounded-2xl border-2 border-indigo-600 bg-slate-950 p-4 space-y-4">
            <div class="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-200">
              <div class="flex items-center gap-2">
                <span class="inline-block h-2.5 w-2.5 rounded-full bg-emerald-400"></span>
                <span class="font-semibold">Live Camera Feed Active — Align document inside the guide frame</span>
              </div>
              <span class="font-mono text-[11px] text-slate-400">
                Mode: {{ facingMode() === 'environment' ? 'Rear Document Camera' : 'Front Camera' }}
              </span>
            </div>

            <div class="relative mx-auto max-w-2xl overflow-hidden rounded-xl bg-black aspect-video flex items-center justify-center">
              <video
                #videoElement
                autoplay
                playsinline
                muted
                class="h-full w-full object-contain"
              ></video>

              <!-- Document Alignment Frame Overlay -->
              <div class="pointer-events-none absolute inset-[8%] rounded-xl border-2 border-dashed border-teal-400/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)] flex flex-col justify-between p-3">
                <div class="flex justify-between text-[11px] font-mono font-semibold text-teal-300">
                  <span>TOP-LEFT CORNER</span>
                  <span>ALIGN MARKSHEET / ADMIT CARD</span>
                  <span>TOP-RIGHT CORNER</span>
                </div>
                <div class="text-center text-[11px] font-mono text-teal-200/90">
                  Keep text flat and well-lit before capturing
                </div>
              </div>
            </div>

            <div class="flex justify-center">
              <button
                type="button"
                (click)="captureVideoFrame()"
                class="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-teal-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-teal-700 shadow-sm cursor-pointer"
              >
                <mat-icon class="!w-5 !h-5 !text-[20px]">camera</mat-icon>
                <span>Capture Document Frame</span>
              </button>
            </div>
          </div>
        }

        <!-- Interactive Cropper & Enhancement Studio -->
        @if (rawCapturedDataUrl()) {
          <div class="grid gap-6 lg:grid-cols-12 pt-2">
            <!-- Left: Source Frame with Visual Crop Box + Controls -->
            <div class="lg:col-span-7 space-y-4">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <h3 class="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Step 1: Adjust Crop Region, Rotation & Scan Filter
                </h3>
                <div class="flex items-center gap-1.5">
                  <button
                    type="button"
                    (click)="rotateCaptured(-90)"
                    class="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
                  >
                    <mat-icon class="!w-4 !h-4 !text-[16px]">rotate_left</mat-icon>
                    <span>Rotate Left</span>
                  </button>
                  <button
                    type="button"
                    (click)="rotateCaptured(90)"
                    class="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
                  >
                    <mat-icon class="!w-4 !h-4 !text-[16px]">rotate_right</mat-icon>
                    <span>Rotate Right</span>
                  </button>
                </div>
              </div>

              <!-- Visual Crop Stage -->
              <div class="relative mx-auto overflow-hidden rounded-xl border border-slate-300 bg-slate-950 p-2 dark:border-slate-700">
                <div class="relative mx-auto inline-block w-full">
                  <img
                    [src]="rawCapturedDataUrl()!"
                    alt="Captured academic document frame for cropping"
                    class="block w-full max-h-80 object-contain rounded-lg select-none"
                  />
                  <!-- Visual Crop Overlay Box -->
                  <div
                    class="pointer-events-none absolute border-2 border-indigo-500 bg-indigo-500/10 shadow-[0_0_0_9999px_rgba(15,23,42,0.45)] transition-all duration-75"
                    [style.left.%]="cropX()"
                    [style.top.%]="cropY()"
                    [style.width.%]="cropW()"
                    [style.height.%]="cropH()"
                  >
                    <span class="absolute top-1 left-1 rounded bg-indigo-700 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white">
                      Crop: {{ cropW() }}% × {{ cropH() }}%
                    </span>
                  </div>
                </div>
              </div>

              <!-- Quick Crop Presets -->
              <div class="flex flex-wrap items-center gap-2 text-xs">
                <span class="font-semibold text-slate-600 dark:text-slate-400">Quick Crop Presets:</span>
                <button
                  type="button"
                  (click)="applyCropPreset(4, 4, 92, 92)"
                  class="rounded-lg border border-slate-300 px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Full Document (Trim Edges)
                </button>
                <button
                  type="button"
                  (click)="applyCropPreset(6, 18, 88, 65)"
                  class="rounded-lg border border-slate-300 px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Marksheet Marks Table
                </button>
                <button
                  type="button"
                  (click)="applyCropPreset(5, 8, 90, 55)"
                  class="rounded-lg border border-slate-300 px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Admit Card Roll & Center Details
                </button>
                <button
                  type="button"
                  (click)="applyCropPreset(0, 0, 100, 100)"
                  class="rounded-lg border border-slate-300 px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Reset 100%
                </button>
              </div>

              <!-- 4 Crop Sliders -->
              <div class="grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
                <div>
                  <label for="crop-x-slider" class="flex justify-between font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    <span>Left Offset</span>
                    <span class="font-mono tabular-nums">{{ cropX() }}%</span>
                  </label>
                  <input
                    id="crop-x-slider"
                    type="range"
                    min="0"
                    max="60"
                    step="1"
                    [value]="cropX()"
                    (input)="onCropSliderChange('x', $event)"
                    class="w-full accent-indigo-700 cursor-pointer"
                  />
                </div>

                <div>
                  <label for="crop-y-slider" class="flex justify-between font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    <span>Top Offset</span>
                    <span class="font-mono tabular-nums">{{ cropY() }}%</span>
                  </label>
                  <input
                    id="crop-y-slider"
                    type="range"
                    min="0"
                    max="60"
                    step="1"
                    [value]="cropY()"
                    (input)="onCropSliderChange('y', $event)"
                    class="w-full accent-indigo-700 cursor-pointer"
                  />
                </div>

                <div>
                  <label for="crop-w-slider" class="flex justify-between font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    <span>Crop Width</span>
                    <span class="font-mono tabular-nums">{{ cropW() }}%</span>
                  </label>
                  <input
                    id="crop-w-slider"
                    type="range"
                    min="20"
                    [max]="100 - cropX()"
                    step="1"
                    [value]="cropW()"
                    (input)="onCropSliderChange('w', $event)"
                    class="w-full accent-indigo-700 cursor-pointer"
                  />
                </div>

                <div>
                  <label for="crop-h-slider" class="flex justify-between font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    <span>Crop Height</span>
                    <span class="font-mono tabular-nums">{{ cropH() }}%</span>
                  </label>
                  <input
                    id="crop-h-slider"
                    type="range"
                    min="20"
                    [max]="100 - cropY()"
                    step="1"
                    [value]="cropH()"
                    (input)="onCropSliderChange('h', $event)"
                    class="w-full accent-indigo-700 cursor-pointer"
                  />
                </div>
              </div>

              <!-- Document Scan Enhancement Mode -->
              <div class="space-y-1.5 text-xs">
                <span class="block font-semibold text-slate-700 dark:text-slate-300">
                  Document Legibility Filter:
                </span>
                <div class="inline-flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
                  <button
                    type="button"
                    (click)="setScanFilter('bright_document')"
                    [class]="'rounded-lg px-3 py-1.5 font-semibold transition-colors cursor-pointer ' + (scanFilter() === 'bright_document' ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400')"
                  >
                    Brightened Document Scan
                  </button>
                  <button
                    type="button"
                    (click)="setScanFilter('high_contrast_bw')"
                    [class]="'rounded-lg px-3 py-1.5 font-semibold transition-colors cursor-pointer ' + (scanFilter() === 'high_contrast_bw' ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400')"
                  >
                    High-Contrast B&W (Crisp Text)
                  </button>
                  <button
                    type="button"
                    (click)="setScanFilter('colour')"
                    [class]="'rounded-lg px-3 py-1.5 font-semibold transition-colors cursor-pointer ' + (scanFilter() === 'colour' ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-900 dark:text-slate-100' : 'text-slate-600 dark:text-slate-400')"
                  >
                    Original Colour
                  </button>
                </div>
              </div>
            </div>

            <!-- Right: Cropped Output Preview & Save to Document Manager Form -->
            <div class="lg:col-span-5 space-y-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/40">
              <div class="flex items-center justify-between">
                <h3 class="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Step 2: Cropped Preview & Save
                </h3>
                <span class="font-mono text-[11px] font-semibold text-teal-700 dark:text-teal-400 tabular-nums">
                  {{ croppedWidth() }}×{{ croppedHeight() }} px · {{ croppedSizeKb() }} KB
                </span>
              </div>

              @if (croppedDataUrl()) {
                <div class="overflow-hidden rounded-xl border border-teal-500/70 bg-white p-2 dark:bg-slate-950">
                  <img
                    [src]="croppedDataUrl()!"
                    alt="Cropped and enhanced academic document preview"
                    class="mx-auto max-h-48 object-contain"
                  />
                </div>
              }

              <div class="space-y-3 text-xs">
                <div>
                  <label for="doc-type-select" class="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Academic Document Type
                  </label>
                  <select
                    id="doc-type-select"
                    [value]="selectedDocType()"
                    (change)="onDocTypeChange($event)"
                    class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-medium text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  >
                    @for (dt of docTypes; track dt) {
                      <option [value]="dt">{{ dt }}</option>
                    }
                  </select>
                </div>

                <div class="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label for="doc-custom-title" class="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Document Label
                    </label>
                    <input
                      id="doc-custom-title"
                      type="text"
                      [value]="docTitle()"
                      (input)="onDocTitleInput($event)"
                      placeholder="e.g. CBSE Class 12 Marksheet"
                      class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label for="doc-exam-tag" class="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Counselling / Exam Tag
                    </label>
                    <select
                      id="doc-exam-tag"
                      [value]="docExamTag()"
                      (change)="onDocExamTagChange($event)"
                      class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-medium text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    >
                      <option value="JoSAA / CSAB & All-India">JoSAA / CSAB & All-India</option>
                      <option value="JEE Main / JEE Advanced">JEE Main / JEE Advanced</option>
                      <option value="State CET (MHT CET / WBJEE / KCET)">State CET (MHT CET / WBJEE / KCET)</option>
                      <option value="BITSAT / VITEEE / MET">BITSAT / VITEEE / MET</option>
                      <option value="Scholarship & Fee Waiver">Scholarship & Fee Waiver</option>
                    </select>
                  </div>
                </div>

                <div class="pt-1 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    (click)="saveToDocumentManager()"
                    class="inline-flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-teal-700 px-4 py-2 text-xs font-bold text-white hover:bg-teal-800 transition-colors cursor-pointer"
                  >
                    <mat-icon class="!w-4 !h-4 !text-[16px]">save</mat-icon>
                    <span>Save to Document Manager</span>
                  </button>

                  <button
                    type="button"
                    (click)="forwardToExamResizer()"
                    class="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-indigo-300 bg-white px-3 py-2 text-xs font-semibold text-indigo-800 hover:bg-indigo-50 dark:border-indigo-700 dark:bg-slate-900 dark:text-indigo-300 cursor-pointer"
                  >
                    <mat-icon class="!w-4 !h-4 !text-[16px]">aspect_ratio</mat-icon>
                    <span>Send to Preset Resizer</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        }
      </section>

      <!-- Document Manager Vault (Saved Academic Documents) -->
      <section
        aria-labelledby="document-vault-heading"
        class="rounded-2xl border border-slate-200 bg-white p-6 space-y-4 shadow-xs dark:border-slate-800 dark:bg-slate-900"
      >
        <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3 dark:border-slate-800">
          <div>
            <h2 id="document-vault-heading" class="text-base font-bold text-slate-900 dark:text-slate-100">
              Saved Academic Document Manager ({{ profileStore.savedDocuments().length }})
            </h2>
            <p class="text-xs text-slate-600 dark:text-slate-400">
              Your scanned and cropped marksheets, admit cards, and certificates stored privately on this device.
            </p>
          </div>
          <span class="font-mono text-xs text-slate-500 tabular-nums">
            Stored locally · 0 bytes sent to server
          </span>
        </div>

        @if (profileStore.savedDocuments().length === 0) {
          <div class="rounded-xl border border-dashed border-slate-300 p-6 text-center space-y-2 dark:border-slate-700">
            <mat-icon class="!w-7 !h-7 !text-[28px] text-slate-400 mx-auto">folder_special</mat-icon>
            <div class="text-sm font-semibold text-slate-800 dark:text-slate-200">
              No scanned documents saved yet
            </div>
            <p class="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Click <strong>Open Device Camera</strong> or <strong>Sample Marksheet</strong> above, adjust the crop box, and click <strong>Save to Document Manager</strong>.
            </p>
          </div>
        } @else {
          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            @for (doc of profileStore.savedDocuments(); track doc.id) {
              <article class="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/50 p-4 gap-3 dark:border-slate-800 dark:bg-slate-800/30">
                <div class="space-y-2">
                  <!-- Unboxed metadata line -->
                  <div class="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                    <span class="font-semibold text-indigo-700 dark:text-indigo-400 truncate">{{ doc.docType }}</span>
                    <span class="font-mono tabular-nums shrink-0">{{ doc.sizeKb }} KB</span>
                  </div>

                  <h3 class="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                    {{ doc.title }}
                  </h3>

                  <div class="text-[11px] text-slate-500 dark:text-slate-400">
                    {{ doc.examTag }} · <span class="font-mono tabular-nums">{{ doc.width }}×{{ doc.height }} px</span>
                  </div>

                  <div class="overflow-hidden rounded-lg border border-slate-200 bg-white p-1.5 dark:border-slate-700 dark:bg-slate-950">
                    <img
                      [src]="doc.dataUrl"
                      [alt]="doc.title"
                      class="mx-auto h-32 object-contain"
                    />
                  </div>
                </div>

                <div class="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/80 pt-2.5 text-xs dark:border-slate-800">
                  <div class="flex items-center gap-2">
                    <a
                      [href]="doc.dataUrl"
                      [download]="doc.id + '-' + doc.docType.toLowerCase().replaceAll(' ', '-') + '.jpg'"
                      class="inline-flex min-h-[36px] items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1 font-semibold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900"
                    >
                      <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">download</mat-icon>
                      <span>Download</span>
                    </a>

                    <button
                      type="button"
                      (click)="loadDocIntoResizer(doc)"
                      class="inline-flex min-h-[36px] items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 cursor-pointer"
                    >
                      <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">photo_size_select_large</mat-icon>
                      <span>Resize</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    (click)="removeDocument(doc.id)"
                    class="inline-flex min-h-[36px] items-center gap-1 rounded-lg px-2 py-1 font-semibold text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/50 cursor-pointer"
                  >
                    <mat-icon class="!w-3.5 !h-3.5 !text-[14px]">delete_outline</mat-icon>
                    <span>Delete</span>
                  </button>
                </div>
              </article>
            }
          </div>
        }
      </section>
    </div>
  `,
})
export class AcademicDocumentScanner {
  readonly api = inject(ApiService);
  readonly profileStore = inject(ProfileStorageService);
  private readonly destroyRef = inject(DestroyRef);

  readonly sendToResizer = output<string>();

  @ViewChild('videoElement') videoElementRef?: ElementRef<HTMLVideoElement>;
  private mediaStream: MediaStream | null = null;

  readonly cameraActive = signal<boolean>(false);
  readonly facingMode = signal<'environment' | 'user'>('environment');
  readonly cameraError = signal<string | null>(null);

  readonly rawCapturedDataUrl = signal<string | null>(null);
  readonly cropX = signal<number>(4);
  readonly cropY = signal<number>(4);
  readonly cropW = signal<number>(92);
  readonly cropH = signal<number>(92);
  readonly scanFilter = signal<'colour' | 'high_contrast_bw' | 'bright_document'>(
    'bright_document'
  );

  readonly croppedDataUrl = signal<string | null>(null);
  readonly croppedWidth = signal<number>(0);
  readonly croppedHeight = signal<number>(0);
  readonly croppedSizeKb = signal<number>(0);

  readonly docTypes: SavedAcademicDocument['docType'][] = [
    'Class 12 Marksheet',
    'Class 10 Marksheet / DOB Proof',
    'Entrance Exam Admit Card',
    'Category / EWS Certificate',
    'Income Certificate',
    'Passport Photo / Signature',
  ];

  readonly selectedDocType = signal<SavedAcademicDocument['docType']>(
    'Class 12 Marksheet'
  );
  readonly docTitle = signal<string>('Class 12 PCM Marks Statement');
  readonly docExamTag = signal<string>('JoSAA / CSAB & All-India');

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.stopCamera();
    });
  }

  async startCamera(): Promise<void> {
    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      this.cameraError.set(
        'Camera API is not available in this browser context.'
      );
      return;
    }

    this.cameraError.set(null);
    this.stopCamera();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: {ideal: this.facingMode()},
          width: {ideal: 1280},
          height: {ideal: 720},
        },
        audio: false,
      });
      this.mediaStream = stream;
      this.cameraActive.set(true);

      window.setTimeout(() => {
        const videoEl = this.videoElementRef?.nativeElement;
        if (videoEl && this.mediaStream) {
          videoEl.srcObject = this.mediaStream;
          videoEl.play().catch(() => {
            // Ignore autoplay interruption
          });
        }
      }, 50);
    } catch {
      this.cameraActive.set(false);
      this.cameraError.set(
        'Could not access device camera (permission denied or no camera hardware detected).'
      );
    }
  }

  async switchCameraFacing(): Promise<void> {
    this.facingMode.set(
      this.facingMode() === 'environment' ? 'user' : 'environment'
    );
    if (this.cameraActive()) {
      await this.startCamera();
    }
  }

  stopCamera(): void {
    if (this.mediaStream) {
      for (const track of this.mediaStream.getTracks()) {
        track.stop();
      }
      this.mediaStream = null;
    }
    this.cameraActive.set(false);
  }

  captureVideoFrame(): void {
    const videoEl = this.videoElementRef?.nativeElement;
    if (!videoEl || typeof document === 'undefined') return;

    const width = videoEl.videoWidth || 960;
    const height = videoEl.videoHeight || 540;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(videoEl, 0, 0, width, height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    this.rawCapturedDataUrl.set(dataUrl);
    this.stopCamera();
    this.applyCropPreset(4, 4, 92, 92);
    this.api.showToast(
      'Captured frame from camera. Adjust the crop area below.',
      'success'
    );
  }

  generateSampleAcademicDoc(kind: 'marksheet' | 'admitcard'): void {
    if (typeof document === 'undefined') return;
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 560;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Desk background around document so user can see cropping in action
    ctx.fillStyle = '#334155';
    ctx.fillRect(0, 0, 800, 560);

    // Document paper sheet
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(48, 36, 704, 488);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.strokeRect(48, 36, 704, 488);

    // Header bar
    ctx.fillStyle = kind === 'marksheet' ? '#1e1b4b' : '#134e4a';
    ctx.fillRect(68, 56, 664, 64);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText(
      kind === 'marksheet'
        ? 'SENIOR SCHOOL CERTIFICATE EXAMINATION — MARKSHEET'
        : 'JOINT ENTRANCE EXAMINATION (MAIN) — PROVISIONAL ADMIT CARD',
      88,
      95
    );

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 15px monospace';
    if (kind === 'marksheet') {
      this.selectedDocType.set('Class 12 Marksheet');
      this.docTitle.set('Class 12 PCM Marks Statement');
      this.docExamTag.set('JoSAA / CSAB & All-India');
      ctx.fillText('Roll No: 26104892     Candidate: AARAV SHARMA     Stream: PCM', 88, 155);
      ctx.strokeStyle = '#cbd5e1';
      ctx.strokeRect(88, 178, 624, 220);
      ctx.font = '14px monospace';
      ctx.fillText('041 MATHEMATICS          THEORY: 076   PRACTICAL: 020   TOTAL: 096 (A1)', 106, 215);
      ctx.fillText('042 PHYSICS              THEORY: 065   PRACTICAL: 030   TOTAL: 095 (A1)', 106, 255);
      ctx.fillText('043 CHEMISTRY            THEORY: 064   PRACTICAL: 030   TOTAL: 094 (A1)', 106, 295);
      ctx.fillText('301 ENGLISH CORE         THEORY: 074   INTERNAL:  020   TOTAL: 094 (A1)', 106, 335);
      ctx.fillText('083 COMPUTER SCIENCE     THEORY: 068   PRACTICAL: 030   TOTAL: 098 (A1)', 106, 375);
      ctx.font = 'bold 15px sans-serif';
      ctx.fillStyle = '#0f766e';
      ctx.fillText('RESULT: PASS · PCM AGGREGATE: 95.0% · VERIFIED SAMPLE SCAN', 88, 445);
    } else {
      this.selectedDocType.set('Entrance Exam Admit Card');
      this.docTitle.set('JEE Main Session 1 Admit Card');
      this.docExamTag.set('JEE Main / JEE Advanced');
      ctx.fillText('Application No: 260310948211     Roll No: DL01049281', 88, 155);
      ctx.fillText('Paper: B.E. / B.Tech (Paper 1)   Shift: Morning (09:00 - 12:00 IST)', 88, 190);
      ctx.strokeStyle = '#cbd5e1';
      ctx.strokeRect(88, 215, 624, 185);
      ctx.font = '14px monospace';
      ctx.fillText('Test Centre Code: DL-014 (iON Digital Zone, Mathura Road, New Delhi)', 106, 255);
      ctx.fillText('Reporting Time: 07:40 AM IST     Gate Closing Time: 08:30 AM IST', 106, 295);
      ctx.fillText('Mandatory Items: Printed Admit Card, Original Aadhaar/ID, 2 Passport Photos', 106, 335);
      ctx.font = 'bold 15px sans-serif';
      ctx.fillStyle = '#3730a3';
      ctx.fillText('SELF-DECLARATION (UNDERTAKING) SIGNED · SAMPLE ADMIT CARD', 88, 445);
    }

    const sampleDataUrl = canvas.toDataURL('image/jpeg', 0.92);
    this.rawCapturedDataUrl.set(sampleDataUrl);
    this.applyCropPreset(6, 6, 88, 88);
  }

  rotateCaptured(degrees: 90 | -90): void {
    const src = this.rawCapturedDataUrl();
    if (!src || typeof window === 'undefined') return;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.height;
      canvas.height = img.width;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((degrees * Math.PI) / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);
      this.rawCapturedDataUrl.set(canvas.toDataURL('image/jpeg', 0.92));
      this.renderCroppedPreview();
    };
    img.src = src;
  }

  applyCropPreset(x: number, y: number, w: number, h: number): void {
    this.cropX.set(x);
    this.cropY.set(y);
    this.cropW.set(w);
    this.cropH.set(h);
    this.renderCroppedPreview();
  }

  onCropSliderChange(
    axis: 'x' | 'y' | 'w' | 'h',
    event: Event
  ): void {
    const val = Number((event.target as HTMLInputElement).value);
    if (Number.isNaN(val)) return;

    if (axis === 'x') {
      this.cropX.set(val);
      if (this.cropX() + this.cropW() > 100) {
        this.cropW.set(100 - this.cropX());
      }
    } else if (axis === 'y') {
      this.cropY.set(val);
      if (this.cropY() + this.cropH() > 100) {
        this.cropH.set(100 - this.cropY());
      }
    } else if (axis === 'w') {
      this.cropW.set(Math.min(val, 100 - this.cropX()));
    } else if (axis === 'h') {
      this.cropH.set(Math.min(val, 100 - this.cropY()));
    }
    this.renderCroppedPreview();
  }

  setScanFilter(
    mode: 'colour' | 'high_contrast_bw' | 'bright_document'
  ): void {
    this.scanFilter.set(mode);
    this.renderCroppedPreview();
  }

  onDocTypeChange(event: Event): void {
    const val = (event.target as HTMLSelectElement)
      .value as SavedAcademicDocument['docType'];
    this.selectedDocType.set(val);
    this.docTitle.set(val);
  }

  onDocTitleInput(event: Event): void {
    this.docTitle.set((event.target as HTMLInputElement).value);
  }

  onDocExamTagChange(event: Event): void {
    this.docExamTag.set((event.target as HTMLSelectElement).value);
  }

  private renderCroppedPreview(): void {
    const src = this.rawCapturedDataUrl();
    if (!src || typeof window === 'undefined') return;

    const img = new Image();
    img.onload = () => {
      const sx = Math.round((this.cropX() / 100) * img.width);
      const sy = Math.round((this.cropY() / 100) * img.height);
      const sw = Math.max(32, Math.round((this.cropW() / 100) * img.width));
      const sh = Math.max(32, Math.round((this.cropH() / 100) * img.height));

      const canvas = document.createElement('canvas');
      canvas.width = sw;
      canvas.height = sh;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

      const filterMode = this.scanFilter();
      if (filterMode !== 'colour') {
        const imgData = ctx.getImageData(0, 0, sw, sh);
        const d = imgData.data;
        for (let i = 0; i < d.length; i += 4) {
          const r = d[i];
          const g = d[i + 1];
          const b = d[i + 2];
          if (filterMode === 'high_contrast_bw') {
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;
            const contrasted = lum > 155 ? Math.min(255, lum + 35) : Math.max(0, (lum - 128) * 1.45 + 128);
            d[i] = contrasted;
            d[i + 1] = contrasted;
            d[i + 2] = contrasted;
          } else if (filterMode === 'bright_document') {
            d[i] = Math.min(255, Math.round(r * 1.08 + 8));
            d[i + 1] = Math.min(255, Math.round(g * 1.08 + 8));
            d[i + 2] = Math.min(255, Math.round(b * 1.08 + 8));
          }
        }
        ctx.putImageData(imgData, 0, 0);
      }

      const outUrl = canvas.toDataURL('image/jpeg', 0.86);
      this.croppedDataUrl.set(outUrl);
      this.croppedWidth.set(sw);
      this.croppedHeight.set(sh);
      const base64Len = outUrl.split(',')[1]?.length || 0;
      const bytes = (base64Len * 3) / 4;
      this.croppedSizeKb.set(Math.round((bytes / 1024) * 10) / 10);
    };
    img.src = src;
  }

  saveToDocumentManager(): void {
    const dataUrl = this.croppedDataUrl();
    if (!dataUrl) return;

    const title = this.docTitle().trim() || this.selectedDocType();
    this.profileStore.addSavedDocument({
      title,
      docType: this.selectedDocType(),
      examTag: this.docExamTag(),
      dataUrl,
      width: this.croppedWidth(),
      height: this.croppedHeight(),
      sizeKb: this.croppedSizeKb(),
      filterApplied: this.scanFilter(),
    });
    this.api.showToast(
      `Saved "${title}" to your Document Manager.`,
      'success'
    );
  }

  forwardToExamResizer(): void {
    const dataUrl = this.croppedDataUrl();
    if (!dataUrl) return;
    this.sendToResizer.emit(dataUrl);
    this.api.showToast(
      'Loaded cropped scan into the Exam Preset Resizer below.',
      'info'
    );
  }

  loadDocIntoResizer(doc: SavedAcademicDocument): void {
    this.sendToResizer.emit(doc.dataUrl);
    this.api.showToast(
      `Loaded "${doc.title}" into the Exam Preset Resizer.`,
      'info'
    );
  }

  removeDocument(id: string): void {
    this.profileStore.deleteSavedDocument(id);
    this.api.showToast('Removed document from Document Manager.', 'info');
  }
}
