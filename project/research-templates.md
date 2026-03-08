# 研究模版体系

## 目标
建立不同研究类型的模版，让方法论可以被迭代和进化。

---

## 模版类型

### 1. Survey Paper（综述论文）模版
**文件位置**: `templates/survey-paper-template.md`
**用途**: 对某个领域的现有研究进行系统性综述
**特点**:
- 强调全面性和系统性
- 分析研究趋势和演进路径
- 识别研究空白和未来方向
- 不需要原创实验

**典型章节结构**:
1. Abstract
2. Introduction
3. Related Work
4. Key Papers Analysis / Literature Review
5. Research Trends Analysis
6. Challenges Identification
7. Future Directions
8. Conclusion
9. References

---

### 2. Empirical Paper（实证论文）模版
**文件位置**: `templates/empirical-paper-template.md`
**用途**: 提出新方法并通过实验验证
**特点**:
- 强调方法论创新
- 需要详细的实验设计和结果分析
- 需要与基线方法对比
- 需要 ablation study（消融实验）

**典型章节结构**:
1. Abstract
2. Introduction
3. Related Work
4. Method / Approach
5. Experiments
   - 5.1 Experimental Setup
   - 5.2 Datasets
   - 5.3 Baselines
   - 5.4 Evaluation Metrics
   - 5.5 Implementation Details
6. Results
   - 6.1 Main Results
   - 6.2 Ablation Study
   - 6.3 Qualitative Analysis
7. Discussion
8. Limitations
9. Conclusion
10. References

---

### 3. Theoretical Paper（理论论文）模版
**文件位置**: `templates/theoretical-paper-template.md`
**用途**: 提出新的理论框架或数学模型
**特点**:
- 强调数学严谨性
- 需要定理证明
- 可能不需要大规模实验
- 强调理论贡献

**典型章节结构**:
1. Abstract
2. Introduction
3. Related Work
4. Preliminaries / Background
5. Theoretical Framework
   - 5.1 Definitions
   - 5.2 Theorem Statements
   - 5.3 Proofs
6. Analysis
7. Discussion
8. Limitations
9. Conclusion
10. References

---

### 4. System Paper（系统论文）模版
**文件位置**: `templates/system-paper-template.md`
**用途**: 描述新的系统设计和实现
**特点**:
- 强调系统架构和工程实现
- 需要系统设计细节
- 需要性能评估和优化
- 可能包含案例研究

**典型章节结构**:
1. Abstract
2. Introduction
3. Related Work
4. System Design
   - 4.1 Architecture Overview
   - 4.2 Key Components
   - 4.3 Design Decisions
5. Implementation
6. Evaluation
   - 6.1 Experimental Setup
   - 6.2 Performance Results
   - 6.3 Case Studies
7. Discussion
8. Limitations
9. Conclusion
10. References

---

## 迭代进化机制

### 版本控制
- 每个模版都有版本号
- 每次改进都记录变更日志
- 保留历史版本以便回溯

### 改进反馈循环
```
使用模版写论文
    ↓
用评估脚本评测论文
    ↓
分析评估结果，识别模版缺陷
    ↓
优化模版
    ↓
更新版本号，记录变更日志
    ↓
返回第一步
```

---

## 使用指南

### 选择合适的模版
- **Survey Paper**: 如果你想对某个领域进行综述
- **Empirical Paper**: 如果你有新方法并想通过实验验证
- **Theoretical Paper**: 如果你有新的理论框架或数学模型
- **System Paper**: 如果你设计了新的系统

### 定制化
- 模版是基础框架，可以根据具体研究调整
- 保留核心结构，但可以增加或减少章节
- 根据领域特点调整内容重点

---

## 模版文件

### 待创建
- [ ] `templates/survey-paper-template.md` - 综述论文模版
- [ ] `templates/empirical-paper-template.md` - 实证论文模版
- [ ] `templates/theoretical-paper-template.md` - 理论论文模版
- [ ] `templates/system-paper-template.md` - 系统论文模版

---

*创建时间: 2026-03-04*
*目标: 建立可迭代进化的研究模版体系*
