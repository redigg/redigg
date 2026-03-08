#!/usr/bin/env python3
"""
redigg-agent CLI - 24 小时不间断运行的本地研究智能体
"""

import click
import sys
from pathlib import Path

# Add the parent directory to the path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))


@click.group()
@click.version_option(version="0.1.0")
def cli():
    """redigg-agent - 24 小时不间断运行的本地研究智能体"""
    pass


@cli.group()
def workspace():
    """Workspace 管理"""
    pass


@workspace.command("create")
@click.argument("name")
def workspace_create(name):
    """创建新的 workspace"""
    from core.workspace.manager import WorkspaceManager

    manager = WorkspaceManager()
    workspace = manager.create(name)
    click.echo(f"✅ Workspace 创建成功: {workspace.name} (ID: {workspace.id})")


@workspace.command("list")
def workspace_list():
    """列出所有 workspace"""
    from core.workspace.manager import WorkspaceManager

    manager = WorkspaceManager()
    workspaces = manager.list()

    if not workspaces:
        click.echo("📭 没有找到 workspace")
        return

    click.echo("📚 Workspace 列表:")
    for ws in workspaces:
        click.echo(f"  - {ws.name} (ID: {ws.id})")


@cli.group()
def research():
    """Research 管理"""
    pass


@research.command("create")
@click.argument("title")
@click.option("--type", "-t", type=click.Choice(["survey", "benchmark", "algorithm_paper"]),
              default="survey", help="Research 类型")
@click.option("--workspace", "-w", help="Workspace ID")
def research_create(title, type, workspace):
    """创建新的 research"""
    from core.research.manager import ResearchManager

    manager = ResearchManager()
    research = manager.create(title=title, type=type, workspace_id=workspace)
    click.echo(f"✅ Research 创建成功: {research.title} (ID: {research.id})")


@research.command("list")
@click.option("--workspace", "-w", help="Workspace ID")
def research_list(workspace):
    """列出所有 research"""
    from core.research.manager import ResearchManager

    manager = ResearchManager()
    researches = manager.list(workspace_id=workspace)

    if not researches:
        click.echo("📭 没有找到 research")
        return

    click.echo("🔬 Research 列表:")
    for res in researches:
        click.echo(f"  - {res.title} (ID: {res.id}, 类型: {res.type})")


@cli.group()
def version():
    """Version 管理"""
    pass


@version.command("list")
@click.argument("research_id")
def version_list(research_id):
    """列出 research 的所有版本"""
    from core.version.manager import VersionManager

    manager = VersionManager()
    versions = manager.list(research_id=research_id)

    if not versions:
        click.echo("📭 没有找到 version")
        return

    click.echo(f"📋 Version 列表 (Research: {research_id}):")
    for ver in versions:
        click.echo(f"  - {ver.version} (ID: {ver.id}, 创建时间: {ver.created_at})")


@cli.command()
def info():
    """显示 redigg-agent 信息"""
    click.echo("🚀 redigg-agent v0.1.0")
    click.echo("24 小时不间断运行的本地研究智能体")
    click.echo("")
    click.echo("使用 'redigg-agent --help' 查看更多命令")


if __name__ == "__main__":
    cli()
