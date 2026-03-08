#!/usr/bin/env python3
"""
测试 redigg-agent 工具集成
"""

import sys
from pathlib import Path

# Add the current directory to the path
sys.path.insert(0, str(Path(__file__).parent))

print("🧪 测试 redigg-agent 工具集成...")
print("=" * 60)

# 测试 1: arXiv 工具
print("\n1️⃣  测试 arXiv 工具...")
try:
    from tools.arxiv import ArxivTool

    print("   ✅ arXiv 工具导入成功")

    arxiv = ArxivTool()
    papers = arxiv.search("large language models", max_results=3)

    print(f"   ✅ 找到 {len(papers)} 篇论文")
    for i, paper in enumerate(papers, 1):
        print(f"     {i}. {paper.title[:60]}...")
        print(f"        作者: {', '.join(paper.authors[:2])}")
        print(f"        分类: {', '.join(paper.categories)}")

except Exception as e:
    print(f"   ❌ arXiv 工具测试失败: {e}")
    import traceback
    traceback.print_exc()

# 测试 2: Zotero 工具
print("\n2️⃣  测试 Zotero 工具...")
try:
    from tools.zotero import ZoteroTool

    print("   ✅ Zotero 工具导入成功")

    zotero = ZoteroTool()
    items = zotero.search("artificial intelligence", limit=2)

    print(f"   ✅ 找到 {len(items)} 个文献条目")
    for i, item in enumerate(items, 1):
        print(f"     {i}. {item.title[:60]}...")
        print(f"        作者: {', '.join(item.authors[:2])}")
        print(f"        标签: {', '.join(item.tags)}")

    collections = zotero.get_collections()
    print(f"   ✅ 找到 {len(collections)} 个收藏夹")
    for col in collections:
        print(f"     - {col['name']}")

except Exception as e:
    print(f"   ❌ Zotero 工具测试失败: {e}")
    import traceback
    traceback.print_exc()

# 测试 3: Overleaf 工具
print("\n3️⃣  测试 Overleaf 工具...")
try:
    from tools.overleaf import OverleafTool

    print("   ✅ Overleaf 工具导入成功")

    overleaf = OverleafTool()
    projects = overleaf.list_projects()

    print(f"   ✅ 找到 {len(projects)} 个项目")
    for i, proj in enumerate(projects, 1):
        print(f"     {i}. {proj.name}")
        print(f"        更新时间: {proj.updated_at}")

    if projects:
        proj = projects[0]
        files = overleaf.list_files(proj.id)
        print(f"   ✅ 项目 '{proj.name}' 有 {len(files)} 个文件")
        for f in files:
            print(f"     - {f.name} ({f.type})")

except Exception as e:
    print(f"   ❌ Overleaf 工具测试失败: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 60)
print("✅ 工具测试完成！")
