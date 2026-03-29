"""Categorize the systematic differences between CHIP SDK and generated clusters."""

import importlib
import inspect
import sys
import os
from collections import Counter, defaultdict

CHIP_SDK_PATH = os.path.join(os.path.dirname(__file__), '..', '.venv', 'lib', 'python3.14', 'site-packages')
GEN_PATH = os.path.join(os.path.dirname(__file__), '..')

sys.path.insert(0, CHIP_SDK_PATH)
import chip.clusters.Objects as chip_sdk_objects
chip_sdk_mod = chip_sdk_objects

mods_to_remove = [k for k in sys.modules if k.startswith('chip')]
for k in mods_to_remove:
    del sys.modules[k]
sys.path.remove(CHIP_SDK_PATH)
sys.path.insert(0, GEN_PATH)

import chip.clusters.Objects as gen_objects
gen_mod = gen_objects


def get_cluster_classes(module):
    clusters = {}
    for name, obj in inspect.getmembers(module, inspect.isclass):
        if hasattr(obj, 'id') and hasattr(obj, 'descriptor'):
            clusters[name] = obj
    return clusters

def get_inner_classes(cls, category_name):
    category = getattr(cls, category_name, None)
    if category is None:
        return {}
    result = {}
    for name, obj in inspect.getmembers(category, inspect.isclass):
        if not name.startswith('_'):
            result[name] = obj
    return result

def describe_descriptor_fields(cls):
    try:
        desc = cls.descriptor
        if hasattr(desc, 'Fields'):
            return [(f.Label, f.Tag, str(f.Type)) for f in desc.Fields]
    except Exception:
        pass
    return []

def describe_enum_members(cls):
    members = {}
    for name, member in cls.__members__.items():
        members[name] = member.value
    return members

def categorize_type_diff(chip_type, gen_type):
    """Categorize the type of difference."""
    # Ignore module path differences (chip.clusters.Objects vs chip.clusters.objects.Foo)
    chip_norm = chip_type.replace('chip.clusters.Objects.', 'REF.')
    gen_norm = gen_type.replace('chip.clusters.objects.', 'REF.').replace('chip.clusters.Globals.', 'REF.')
    # Remove double cluster name in gen (e.g., AccessControl.AccessControl. -> AccessControl.)
    import re
    gen_norm = re.sub(r'REF\.(\w+)\.(\1)\.', r'REF.\1.', gen_norm)

    if chip_norm == gen_norm:
        return 'module_path_only'

    # Check if CHIP uses uint but gen uses a bitmap/enum type
    if 'uint' in chip_type and ('Bitmap' in gen_type or 'IntFlag' in gen_type or 'flag' in gen_type.lower()):
        return 'bitmap_instead_of_uint'
    if 'uint' in chip_type and ('Enum' in gen_type):
        return 'enum_instead_of_uint'

    # Check if gen uses | None where chip doesn't (list element optionality)
    if '| None]' in gen_type and '| None]' not in chip_type and 'List' in chip_type:
        return 'list_element_nullable_in_gen'

    # Check aenum vs enum
    if 'aenum' in chip_type and "enum '" in gen_type:
        return 'aenum_vs_enum'

    # Check if types are fundamentally different (str vs uint, bool vs uint, etc.)
    if 'str' in chip_type and 'uint' in gen_type:
        return 'str_vs_uint'
    if 'bool' in chip_type and 'uint' in gen_type:
        return 'bool_vs_uint'
    if 'bytes' in chip_type and 'uint' in gen_type:
        return 'bytes_vs_uint'
    if 'float32' in chip_type and 'uint' in gen_type:
        return 'float32_vs_uint'

    # Optionality differences
    chip_has_optional = 'Optional' in chip_type or 'None' in chip_type
    gen_has_optional = 'Optional' in gen_type or 'None' in gen_type
    if chip_has_optional != gen_has_optional:
        return 'optionality_mismatch'

    return 'other'


def main():
    chip_clusters = get_cluster_classes(chip_sdk_mod)
    gen_clusters = get_cluster_classes(gen_mod)
    common = set(chip_clusters.keys()) & set(gen_clusters.keys())

    issue_counts = Counter()
    issue_examples = defaultdict(list)

    # Track specific issues
    eventlist_clusters = 0
    duplicate_fields = []
    missing_command_fields = []
    name_mismatches = []

    categories = ['Enums', 'Bitmaps', 'Structs', 'Commands', 'Attributes', 'Events']

    for cluster_name in sorted(common):
        chip_cls = chip_clusters[cluster_name]
        gen_cls = gen_clusters[cluster_name]

        # Check cluster-level descriptor
        chip_fields = describe_descriptor_fields(chip_cls)
        gen_fields = describe_descriptor_fields(gen_cls)

        chip_labels = [f[0] for f in chip_fields]
        gen_labels = [f[0] for f in gen_fields]

        # Duplicates in gen
        gen_counts = Counter(gen_labels)
        for label, count in gen_counts.items():
            if count > 1:
                duplicate_fields.append(f"{cluster_name}.{label} (x{count})")

        # eventList in gen but not CHIP
        if 'eventList' in set(gen_labels) - set(chip_labels):
            eventlist_clusters += 1

        # Field type differences
        chip_by_label = {f[0]: f for f in chip_fields}
        gen_by_label = {f[0]: f for f in gen_fields}
        for label in set(chip_by_label.keys()) & set(gen_by_label.keys()):
            cf = chip_by_label[label]
            gf = gen_by_label[label]
            if cf[2] != gf[2]:
                cat = categorize_type_diff(cf[2], gf[2])
                issue_counts[f'descriptor_{cat}'] += 1
                if len(issue_examples[f'descriptor_{cat}']) < 3:
                    issue_examples[f'descriptor_{cat}'].append(f"{cluster_name}.{label}")

        for cat in categories:
            chip_inner = get_inner_classes(chip_cls, cat)
            gen_inner = get_inner_classes(gen_cls, cat)

            chip_names = set(chip_inner.keys())
            gen_names = set(gen_inner.keys())

            # Name mismatches (present in one but not other, excluding entirely new)
            for c_name in chip_names - gen_names:
                # Check if there's a close match in gen
                for g_name in gen_names - chip_names:
                    if c_name.lower() == g_name.lower():
                        name_mismatches.append(f"{cluster_name}.{cat}: CHIP={c_name} Gen={g_name} (case)")
                    # Check for Enum suffix mismatch (e.g., CHIP=Type, Gen=TypeEnum)
                    elif c_name + "Enum" == g_name or g_name + "Enum" == c_name:
                        name_mismatches.append(f"{cluster_name}.{cat}: CHIP={c_name} Gen={g_name} (Enum suffix)")
                    # Check for Bitmap suffix mismatch
                    elif c_name + "Bitmap" == g_name or g_name + "Bitmap" == c_name:
                        name_mismatches.append(f"{cluster_name}.{cat}: CHIP={c_name} Gen={g_name} (Bitmap suffix)")

            if chip_names - gen_names:
                issue_counts[f'{cat}_only_in_chip'] += len(chip_names - gen_names)
            if gen_names - chip_names:
                issue_counts[f'{cat}_only_in_gen'] += len(gen_names - chip_names)

            for inner_name in sorted(chip_names & gen_names):
                chip_inner_cls = chip_inner[inner_name]
                gen_inner_cls = gen_inner[inner_name]

                if cat in ('Enums', 'Bitmaps'):
                    chip_members = describe_enum_members(chip_inner_cls)
                    gen_members = describe_enum_members(gen_inner_cls)
                    chip_keys = set(chip_members.keys())
                    gen_keys = set(gen_members.keys())
                    if chip_keys != gen_keys:
                        issue_counts[f'{cat}_member_name_diff'] += 1
                        if len(issue_examples[f'{cat}_member_name_diff']) < 5:
                            issue_examples[f'{cat}_member_name_diff'].append(
                                f"{cluster_name}.{inner_name}: chip_only={sorted(chip_keys - gen_keys)[:3]} gen_only={sorted(gen_keys - chip_keys)[:3]}")
                    for k in sorted(chip_keys & gen_keys):
                        if chip_members[k] != gen_members[k]:
                            issue_counts[f'{cat}_member_value_diff'] += 1
                            if len(issue_examples[f'{cat}_member_value_diff']) < 5:
                                issue_examples[f'{cat}_member_value_diff'].append(
                                    f"{cluster_name}.{inner_name}.{k}: CHIP={chip_members[k]} Gen={gen_members[k]}")

                elif cat in ('Commands', 'Structs', 'Events'):
                    chip_desc = describe_descriptor_fields(chip_inner_cls)
                    gen_desc = describe_descriptor_fields(gen_inner_cls)
                    chip_desc_labels = set(f[0] for f in chip_desc)
                    gen_desc_labels = set(f[0] for f in gen_desc)

                    if chip_desc_labels - gen_desc_labels:
                        issue_counts[f'{cat}_fields_missing_in_gen'] += len(chip_desc_labels - gen_desc_labels)
                        if len(issue_examples[f'{cat}_fields_missing_in_gen']) < 5:
                            issue_examples[f'{cat}_fields_missing_in_gen'].append(
                                f"{cluster_name}.{inner_name}: {sorted(chip_desc_labels - gen_desc_labels)}")

                    # Type differences
                    chip_by = {f[0]: f for f in chip_desc}
                    gen_by = {f[0]: f for f in gen_desc}
                    for label in sorted(chip_desc_labels & gen_desc_labels):
                        cf = chip_by[label]
                        gf = gen_by[label]
                        if cf[2] != gf[2]:
                            cat_type = categorize_type_diff(cf[2], gf[2])
                            issue_counts[f'{cat}_field_{cat_type}'] += 1
                            if len(issue_examples[f'{cat}_field_{cat_type}']) < 3:
                                issue_examples[f'{cat}_field_{cat_type}'].append(
                                    f"{cluster_name}.{inner_name}.{label}")

                elif cat == 'Attributes':
                    # Attributes don't have descriptors the same way; check the attribute_type
                    pass

    # Print summary
    print("=" * 60)
    print("SYSTEMATIC DIFFERENCES SUMMARY")
    print("=" * 60)

    print(f"\n## eventList in generated but not CHIP SDK: {eventlist_clusters} clusters")

    print(f"\n## Duplicate descriptor fields: {len(duplicate_fields)}")
    for d in duplicate_fields:
        print(f"  {d}")

    print(f"\n## Name mismatches (case differences): {len(name_mismatches)}")
    for m in name_mismatches[:20]:
        print(f"  {m}")

    print(f"\n## Issue counts:")
    for issue, count in sorted(issue_counts.items(), key=lambda x: -x[1]):
        print(f"  {issue}: {count}")
        for ex in issue_examples.get(issue, []):
            print(f"    e.g. {ex}")

    # Now check for commands that have fields in CHIP but empty in gen
    print(f"\n## Commands with fields in CHIP but empty in generated:")
    count = 0
    for cluster_name in sorted(common):
        chip_cmds = get_inner_classes(chip_clusters[cluster_name], 'Commands')
        gen_cmds = get_inner_classes(gen_clusters[cluster_name], 'Commands')
        for cmd_name in sorted(set(chip_cmds.keys()) & set(gen_cmds.keys())):
            chip_desc = describe_descriptor_fields(chip_cmds[cmd_name])
            gen_desc = describe_descriptor_fields(gen_cmds[cmd_name])
            if chip_desc and not gen_desc:
                print(f"  {cluster_name}.Commands.{cmd_name}: CHIP has {len(chip_desc)} fields, Gen has 0")
                count += 1
    print(f"  Total: {count}")


if __name__ == '__main__':
    main()
