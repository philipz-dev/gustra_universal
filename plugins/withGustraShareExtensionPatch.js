/**
 * Post-processes the expo-sharing iOS Share Extension so it accepts
 * `.gustrashare` / `com.philip.gustra.share` (Swift parity) and shows as "Gustra".
 */
const {
  withDangerousMod,
  createRunOncePlugin,
} = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const SHARE_UTI = 'com.philip.gustra.share';
const EXTENSION_DIR = 'expo-sharing-extension';

const GUSTRASHARE_HANDLER = `
    if provider.hasItemConformingToTypeIdentifier("${SHARE_UTI}") {
      return await handleGustraSharePackage(provider)
    }

    if provider.hasItemConformingToTypeIdentifier(UTType.json.identifier) ||
    provider.hasItemConformingToTypeIdentifier(UTType.data.identifier) {
      return await handleFile(provider, type: .file, utType: .data)
    }
`;

const GUSTRASHARE_METHOD = `
  /// Swift parity: stage custom UTI via loadFileRepresentation into the App Group.
  private func handleGustraSharePackage(_ provider: NSItemProvider) async -> SharePayload? {
    let groupId = appGroupId
    return await withCheckedContinuation { continuation in
      provider.loadFileRepresentation(forTypeIdentifier: "${SHARE_UTI}") { url, _ in
        guard let url,
              let containerURL = FileManager.default.containerURL(
                forSecurityApplicationGroupIdentifier: groupId
              )
        else {
          continuation.resume(returning: nil)
          return
        }

        let filename = url.pathExtension.lowercased() == "gustrashare"
          ? url.lastPathComponent
          : "Gustra.gustrashare"
        let destinationURL = containerURL.appendingPathComponent(filename)

        do {
          if FileManager.default.fileExists(atPath: destinationURL.path) {
            try FileManager.default.removeItem(at: destinationURL)
          }
          // Temporary file is deleted when this callback returns — copy first.
          try FileManager.default.copyItem(at: url, to: destinationURL)
        } catch {
          continuation.resume(returning: nil)
          return
        }

        let size = try? FileManager.default.attributesOfItem(atPath: destinationURL.path)[.size] as? Int
        continuation.resume(
          returning: SharePayload(
            type: .file,
            value: destinationURL.absoluteString,
            mimeType: "application/json",
            metadata: ShareMetadata(originalName: filename, size: size)
          )
        )
      }
    }
  }
`;

function patchShareIntoViewController(swiftPath) {
  if (!fs.existsSync(swiftPath)) return false;
  let source = fs.readFileSync(swiftPath, 'utf8');
  if (source.includes('handleGustraSharePackage')) return true;

  const marker = `    if provider.hasItemConformingToTypeIdentifier(UTType.text.identifier) {
      return await handleText(provider)
    }

    return nil`;

  if (!source.includes(marker)) {
    throw new Error(
      'withGustraShareExtensionPatch: ShareIntoViewController.swift marker not found — expo-sharing template changed?',
    );
  }

  source = source.replace(
    marker,
    `    if provider.hasItemConformingToTypeIdentifier(UTType.text.identifier) {
      return await handleText(provider)
    }
${GUSTRASHARE_HANDLER}
    return nil`,
  );

  // Insert helper before the closing brace of the class (before final `}` of file's class).
  const closeMarker = `  private func close() {
    self.extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
  }
}`;

  if (!source.includes(closeMarker)) {
    throw new Error(
      'withGustraShareExtensionPatch: close() marker not found — expo-sharing template changed?',
    );
  }

  source = source.replace(
    closeMarker,
    `  private func close() {
    self.extensionContext?.completeRequest(returningItems: nil, completionHandler: nil)
  }
${GUSTRASHARE_METHOD}
}`,
  );

  fs.writeFileSync(swiftPath, source);
  return true;
}

function patchInfoPlist(plistPath) {
  if (!fs.existsSync(plistPath)) return false;
  let xml = fs.readFileSync(plistPath, 'utf8');

  xml = xml.replace(
    /<key>CFBundleDisplayName<\/key>\s*<string>\$\(PRODUCT_NAME\)<\/string>/,
    '<key>CFBundleDisplayName</key>\n\t<string>Gustra</string>',
  );

  if (!xml.includes(SHARE_UTI)) {
    const importedTypes = `
	<key>UTImportedTypeDeclarations</key>
	<array>
		<dict>
			<key>UTTypeIdentifier</key>
			<string>${SHARE_UTI}</string>
			<key>UTTypeDescription</key>
			<string>Gustra Share Package</string>
			<key>UTTypeConformsTo</key>
			<array>
				<string>public.json</string>
				<string>public.data</string>
			</array>
			<key>UTTypeTagSpecification</key>
			<dict>
				<key>public.filename-extension</key>
				<array>
					<string>gustrashare</string>
				</array>
				<key>public.mime-type</key>
				<array>
					<string>application/json</string>
				</array>
			</dict>
		</dict>
	</array>
`;
    if (!xml.includes('</dict>\n</plist>')) {
      throw new Error(
        'withGustraShareExtensionPatch: unexpected Info.plist format',
      );
    }
    xml = xml.replace('</dict>\n</plist>', `${importedTypes}</dict>\n</plist>`);
  }

  fs.writeFileSync(plistPath, xml);
  return true;
}

const withGustraShareExtensionPatch = (config) =>
  withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const root = path.join(cfg.modRequest.platformProjectRoot, EXTENSION_DIR);
      patchShareIntoViewController(
        path.join(root, 'ShareIntoViewController.swift'),
      );
      patchInfoPlist(path.join(root, 'Info.plist'));
      return cfg;
    },
  ]);

module.exports = createRunOncePlugin(
  withGustraShareExtensionPatch,
  'with-gustra-share-extension-patch',
  '1.0.0',
);
