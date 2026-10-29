#!/usr/bin/env python3
"""
Creates a 100% Windows File Explorer / Compressed Folder compatible ZIP archive
for the Areva Paints Fullstack Project.

Features:
- Encloses all project files within a root folder `areva-paints-fullstack/`
- Emits explicit directory entries with MS-DOS directory flags (0x10) and standard trailing slashes
- Standardizes POSIX/DOS attributes to eliminate Windows "Cannot complete extraction" or "Folder is invalid" errors
- Includes full backend, frontend, components, types, assets, and documentation
"""

import os
import sys
import time
import zipfile

def build_zip():
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
    output_zip = os.path.join(project_root, 'public', 'areva-paints-fullstack.zip')
    
    os.makedirs(os.path.dirname(output_zip), exist_ok=True)
    
    if os.path.exists(output_zip):
        os.remove(output_zip)
        
    root_folder = 'areva-paints-fullstack'
    
    # Files to include explicitly or folders to walk
    include_root_files = [
        'package.json',
        'tsconfig.json',
        'vite.config.ts',
        'server.ts',
        'index.html',
        'README.md',
        '.env.example',
        '.gitignore',
        'metadata.json'
    ]
    
    include_dirs = [
        'src',
        'public/assets'
    ]
    
    current_time = time.localtime(time.time())[:6]
    
    dirs_added = set()
    
    with zipfile.ZipFile(output_zip, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        # 1. Add top-level root folder
        root_dir_info = zipfile.ZipInfo(root_folder + '/', date_time=current_time)
        root_dir_info.create_system = 0  # MS-DOS FAT
        root_dir_info.external_attr = 0x10  # Directory attribute
        zf.writestr(root_dir_info, '')
        dirs_added.add(root_folder)
        
        def ensure_parent_dirs(archive_path):
            parts = archive_path.split('/')[:-1]
            current = ''
            for part in parts:
                current = f"{current}/{part}" if current else part
                if current not in dirs_added:
                    dir_info = zipfile.ZipInfo(current + '/', date_time=current_time)
                    dir_info.create_system = 0  # MS-DOS
                    dir_info.external_attr = 0x10  # DOS Directory
                    zf.writestr(dir_info, '')
                    dirs_added.add(current)
        
        # 2. Add root config files
        for filename in include_root_files:
            file_path = os.path.join(project_root, filename)
            if os.path.exists(file_path):
                arcname = f"{root_folder}/{filename}"
                ensure_parent_dirs(arcname)
                
                with open(file_path, 'rb') as f:
                    data = f.read()
                
                zinfo = zipfile.ZipInfo(arcname, date_time=current_time)
                zinfo.create_system = 0  # MS-DOS
                zinfo.external_attr = 0x20  # Archive file attribute
                zf.writestr(zinfo, data)
                print(f"[Added File] {arcname} ({len(data)} bytes)")
        
        # 3. Add directories recursively
        for dir_rel in include_dirs:
            dir_full = os.path.join(project_root, dir_rel)
            if not os.path.exists(dir_full):
                continue
                
            for root, dirs, files in os.walk(dir_full):
                # Filter out unwanted subdirs
                dirs[:] = [d for d in dirs if d not in ['node_modules', '.git', 'dist', '__pycache__']]
                
                rel_from_root = os.path.relpath(root, project_root).replace('\\', '/')
                archive_dir_path = f"{root_folder}/{rel_from_root}"
                
                if archive_dir_path not in dirs_added:
                    dir_info = zipfile.ZipInfo(archive_dir_path + '/', date_time=current_time)
                    dir_info.create_system = 0
                    dir_info.external_attr = 0x10
                    zf.writestr(dir_info, '')
                    dirs_added.add(archive_dir_path)
                
                for f in sorted(files):
                    if f.endswith('.zip') or f.endswith('.pyc') or f.startswith('.'):
                        continue
                    full_fpath = os.path.join(root, f)
                    rel_fpath = os.path.relpath(full_fpath, project_root).replace('\\', '/')
                    arcname = f"{root_folder}/{rel_fpath}"
                    
                    ensure_parent_dirs(arcname)
                    
                    with open(full_fpath, 'rb') as fp:
                        data = fp.read()
                    
                    zinfo = zipfile.ZipInfo(arcname, date_time=current_time)
                    zinfo.create_system = 0
                    zinfo.external_attr = 0x20  # File
                    zf.writestr(zinfo, data)
                    print(f"[Added File] {arcname}")
    
    # 4. Verify Archive
    print("\n--- Testing Generated Archive Integrity ---")
    with zipfile.ZipFile(output_zip, 'r') as check_zf:
        bad_file = check_zf.testzip()
        if bad_file:
            print(f"ERROR: Corrupted entry found: {bad_file}", file=sys.stderr)
            sys.exit(1)
        total_items = len(check_zf.infolist())
        file_size_mb = os.path.getsize(output_zip) / (1024 * 1024)
        print(f"SUCCESS: {total_items} entries verified cleanly. Archive size: {file_size_mb:.2f} MB")
        print(f"Output saved to: {output_zip}")

if __name__ == '__main__':
    build_zip()
