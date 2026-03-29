"""Compare generated Matter.js cluster definitions against CHIP SDK reference.

Dumps structural differences: class names, field names/types, enum values, etc.
"""

import importlib
import inspect
import sys
import os

# We need two separate copies of chip.clusters - the CHIP SDK one and our generated one.
# Strategy: import CHIP SDK first, save refs, then swap path and import generated.

CHIP_SDK_PATH = os.path.join(os.path.dirname(__file__), '..', '.venv', 'lib', 'python3.14', 'site-packages')
GEN_PATH = os.path.join(os.path.dirname(__file__), '..')

# First: import CHIP SDK Objects
sys.path.insert(0, CHIP_SDK_PATH)
import chip.clusters.Objects as chip_sdk_objects
# Save a reference to the CHIP clusters module
chip_sdk_mod = chip_sdk_objects

# Now: clear chip modules from sys.modules and import our generated ones
mods_to_remove = [k for k in sys.modules if k.startswith('chip')]
for k in mods_to_remove:
    del sys.modules[k]
sys.path.remove(CHIP_SDK_PATH)
sys.path.insert(0, GEN_PATH)

import chip.clusters.Objects as gen_objects
gen_mod = gen_objects


def get_cluster_classes(module):
    """Get all Cluster subclasses from a module."""
    clusters = {}
    for name, obj in inspect.getmembers(module, inspect.isclass):
        if hasattr(obj, 'id') and hasattr(obj, 'descriptor'):
            clusters[name] = obj
    return clusters


def get_inner_classes(cls, category_name):
    """Get inner classes under Enums, Bitmaps, Commands, Attributes, Structs, Events."""
    category = getattr(cls, category_name, None)
    if category is None:
        return {}
    result = {}
    for name, obj in inspect.getmembers(category, inspect.isclass):
        if not name.startswith('_'):
            result[name] = obj
    return result


def describe_descriptor_fields(cls):
    """Extract descriptor Fields list from a class."""
    try:
        desc = cls.descriptor
        if hasattr(desc, 'Fields'):
            return [(f.Label, f.Tag, str(f.Type)) for f in desc.Fields]
    except Exception:
        pass
    return []


def describe_class_fields(cls):
    """Get dataclass field names and type annotations."""
    fields = {}
    for name, annotation in getattr(cls, '__annotations__', {}).items():
        if name.startswith('_'):
            continue
        fields[name] = str(annotation)
    return fields


def describe_enum_members(cls):
    """Get enum member names and values."""
    members = {}
    for name, member in cls.__members__.items():
        members[name] = member.value
    return members


def compare_clusters():
    chip_clusters = get_cluster_classes(chip_sdk_mod)
    gen_clusters = get_cluster_classes(gen_mod)

    print(f"CHIP SDK clusters: {len(chip_clusters)}")
    print(f"Generated clusters: {len(gen_clusters)}")
    print()

    chip_only = set(chip_clusters.keys()) - set(gen_clusters.keys())
    gen_only = set(gen_clusters.keys()) - set(chip_clusters.keys())
    common = set(chip_clusters.keys()) & set(gen_clusters.keys())

    if chip_only:
        print(f"=== Clusters only in CHIP SDK ({len(chip_only)}) ===")
        for name in sorted(chip_only):
            print(f"  {name} (id=0x{chip_clusters[name].id:08X})")
        print()

    if gen_only:
        print(f"=== Clusters only in Generated ({len(gen_only)}) ===")
        for name in sorted(gen_only):
            print(f"  {name} (id=0x{gen_clusters[name].id:08X})")
        print()

    categories = ['Enums', 'Bitmaps', 'Structs', 'Commands', 'Attributes', 'Events']

    for cluster_name in sorted(common):
        chip_cls = chip_clusters[cluster_name]
        gen_cls = gen_clusters[cluster_name]
        diffs = []

        if chip_cls.id != gen_cls.id:
            diffs.append(f"  ID mismatch: CHIP=0x{chip_cls.id:08X} Gen=0x{gen_cls.id:08X}")

        # Compare cluster-level descriptor fields
        chip_fields = describe_descriptor_fields(chip_cls)
        gen_fields = describe_descriptor_fields(gen_cls)
        if chip_fields != gen_fields:
            chip_labels = [f[0] for f in chip_fields]
            gen_labels = [f[0] for f in gen_fields]

            # Check for duplicates
            from collections import Counter
            gen_label_counts = Counter(gen_labels)
            dupes = {k: v for k, v in gen_label_counts.items() if v > 1}
            if dupes:
                diffs.append(f"  DUPLICATE descriptor fields in Gen: {dupes}")

            chip_set = set(chip_labels)
            gen_set = set(gen_labels)
            only_chip = chip_set - gen_set
            only_gen = gen_set - chip_set

            if only_chip:
                diffs.append(f"  Descriptor fields only in CHIP: {sorted(only_chip)}")
            if only_gen:
                diffs.append(f"  Descriptor fields only in Gen: {sorted(only_gen)}")

            # Check field types for common fields
            chip_by_label = {f[0]: f for f in chip_fields}
            gen_by_label = {f[0]: f for f in gen_fields}
            for label in sorted(chip_set & gen_set):
                cf = chip_by_label[label]
                gf = gen_by_label[label]
                if cf[2] != gf[2]:
                    diffs.append(f"  Descriptor '{label}' type: CHIP={cf[2]} Gen={gf[2]}")

        # Compare each category
        for cat in categories:
            chip_inner = get_inner_classes(chip_cls, cat)
            gen_inner = get_inner_classes(gen_cls, cat)

            chip_names = set(chip_inner.keys())
            gen_names = set(gen_inner.keys())
            only_chip_inner = chip_names - gen_names
            only_gen_inner = gen_names - chip_names

            if only_chip_inner:
                diffs.append(f"  {cat} only in CHIP: {sorted(only_chip_inner)}")
            if only_gen_inner:
                diffs.append(f"  {cat} only in Gen: {sorted(only_gen_inner)}")

            for inner_name in sorted(chip_names & gen_names):
                chip_inner_cls = chip_inner[inner_name]
                gen_inner_cls = gen_inner[inner_name]

                if cat in ('Enums', 'Bitmaps'):
                    chip_members = describe_enum_members(chip_inner_cls)
                    gen_members = describe_enum_members(gen_inner_cls)
                    if chip_members != gen_members:
                        chip_keys = set(chip_members.keys())
                        gen_keys = set(gen_members.keys())
                        only_c = chip_keys - gen_keys
                        only_g = gen_keys - chip_keys
                        if only_c:
                            diffs.append(f"  {cat}.{inner_name} members only in CHIP: {sorted(only_c)}")
                        if only_g:
                            diffs.append(f"  {cat}.{inner_name} members only in Gen: {sorted(only_g)}")
                        for k in sorted(chip_keys & gen_keys):
                            if chip_members[k] != gen_members[k]:
                                diffs.append(f"  {cat}.{inner_name}.{k}: CHIP={chip_members[k]} Gen={gen_members[k]}")

                elif cat in ('Commands', 'Structs', 'Attributes', 'Events'):
                    chip_desc = describe_descriptor_fields(chip_inner_cls)
                    gen_desc = describe_descriptor_fields(gen_inner_cls)
                    if chip_desc != gen_desc:
                        chip_desc_labels = [f[0] for f in chip_desc]
                        gen_desc_labels = [f[0] for f in gen_desc]
                        chip_desc_set = set(chip_desc_labels)
                        gen_desc_set = set(gen_desc_labels)
                        only_c = chip_desc_set - gen_desc_set
                        only_g = gen_desc_set - chip_desc_set
                        if only_c:
                            diffs.append(f"  {cat}.{inner_name} fields only in CHIP: {sorted(only_c)}")
                        if only_g:
                            diffs.append(f"  {cat}.{inner_name} fields only in Gen: {sorted(only_g)}")
                        # Check type differences
                        chip_by_label = {f[0]: f for f in chip_desc}
                        gen_by_label = {f[0]: f for f in gen_desc}
                        for label in sorted(chip_desc_set & gen_desc_set):
                            cf = chip_by_label[label]
                            gf = gen_by_label[label]
                            if cf[2] != gf[2]:
                                diffs.append(f"  {cat}.{inner_name}.{label} type: CHIP={cf[2]} Gen={gf[2]}")

        if diffs:
            print(f"=== {cluster_name} (id=0x{chip_cls.id:08X}) ===")
            for d in diffs:
                print(d)
            print()


if __name__ == '__main__':
    compare_clusters()
