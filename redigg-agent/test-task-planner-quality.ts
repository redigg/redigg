/**
 * TaskPlanner 和 QualityChecker 测试套件
 * 
 * 测试场景：
 * 1. 文献综述任务
 * 2. 实验设计任务
 * 3. 数据分析任务
 */

import { TaskPlanner, TaskType, TaskPlan, TaskStep } from './src/agent/TaskPlanner';
import { QualityChecker, DEFAULT_THRESHOLDS, QualityReport, QualityDimension } from './src/agent/QualityChecker';

// ============== TaskPlanner 测试 ==============

function testTaskPlanner() {
  console.log('\n========== TaskPlanner 测试 ==========\n');
  
  const planner = new TaskPlanner();
  let passed = 0;
  let failed = 0;

  // 测试 1: 文献综述任务分类
  console.log('测试 1: 文献综述任务分类');
  const lrClassification = planner.classifyTask('I need a literature review on quantum computing in cryptography');
  if (lrClassification.type === 'literature_review' && lrClassification.confidence > 0.5) {
    console.log('✅ 通过：正确分类为 literature_review');
    passed++;
  } else {
    console.log(`❌ 失败：期望 literature_review，得到 ${lrClassification.type}`);
    failed++;
  }

  // 测试 2: 实验设计任务分类
  console.log('\n测试 2: 实验设计任务分类');
  const edClassification = planner.classifyTask('Design an experiment to validate hypothesis X');
  if (edClassification.type === 'experiment_design') {
    console.log('✅ 通过：正确分类为 experiment_design');
    passed++;
  } else {
    console.log(`❌ 失败：期望 experiment_design，得到 ${edClassification.type}`);
    failed++;
  }

  // 测试 3: 数据分析任务分类
  console.log('\n测试 3: 数据分析任务分类');
  const daClassification = planner.classifyTask('Analyze this dataset and find patterns');
  if (daClassification.type === 'data_analysis') {
    console.log('✅ 通过：正确分类为 data_analysis');
    passed++;
  } else {
    console.log(`❌ 失败：期望 data_analysis，得到 ${daClassification.type}`);
    failed++;
  }

  // 测试 4: 文献综述计划生成
  console.log('\n测试 4: 文献综述计划生成');
  const lrPlan = planner.generatePlan('task_001', 'Quantum computing in cryptography', 'literature_review');
  if (lrPlan.steps.length >= 3 && lrPlan.taskType === 'literature_review') {
    console.log(`✅ 通过：生成了 ${lrPlan.steps.length} 个步骤的计划`);
    passed++;
  } else {
    console.log(`❌ 失败：计划步骤不足或类型错误`);
    failed++;
  }

  // 测试 5: 文献综述计划步骤验证
  console.log('\n测试 5: 文献综述计划步骤验证');
  const lrStepSkills = lrPlan.steps.map((s: TaskStep) => s.skillName);
  const hasLiteratureReview = lrStepSkills.includes('LiteratureReviewSkill');
  const hasCitationFormatting = lrStepSkills.includes('CitationFormattingSkill');
  if (hasLiteratureReview && hasCitationFormatting) {
    console.log('✅ 通过：计划包含正确的技能');
    passed++;
  } else {
    console.log(`❌ 失败：缺少必要技能`);
    failed++;
  }

  // 测试 6: 实验设计计划生成
  console.log('\n测试 6: 实验设计计划生成');
  const edPlan = planner.generatePlan('task_002', 'Design experiment for X hypothesis', 'experiment_design');
  if (edPlan.steps.length >= 3 && edPlan.taskType === 'experiment_design') {
    console.log(`✅ 通过：生成了 ${edPlan.steps.length} 个步骤的计划`);
    passed++;
  } else {
    console.log(`❌ 失败：计划步骤不足或类型错误`);
    failed++;
  }

  // 测试 7: 数据分析计划生成
  console.log('\n测试 7: 数据分析计划生成');
  const daPlan = planner.generatePlan('task_003', 'Analyze dataset and visualize results', 'data_analysis');
  if (daPlan.steps.length >= 4 && daPlan.taskType === 'data_analysis') {
    console.log(`✅ 通过：生成了 ${daPlan.steps.length} 个步骤的计划`);
    passed++;
  } else {
    console.log(`❌ 失败：计划步骤不足或类型错误`);
    failed++;
  }

  // 测试 8: 计划依赖关系验证
  console.log('\n测试 8: 计划依赖关系验证');
  const validation = planner.validatePlan(lrPlan);
  if (validation.valid) {
    console.log('✅ 通过：计划依赖关系有效');
    passed++;
  } else {
    console.log(`❌ 失败：${validation.errors.join(', ')}`);
    failed++;
  }

  // 测试 9: 推荐技能获取
  console.log('\n测试 9: 推荐技能获取');
  const recommendedSkills = planner.getRecommendedSkills('literature_review');
  if (recommendedSkills.length > 0 && recommendedSkills.includes('LiteratureReviewSkill')) {
    console.log(`✅ 通过：推荐了 ${recommendedSkills.length} 个技能`);
    passed++;
  } else {
    console.log(`❌ 失败：推荐技能列表错误`);
    failed++;
  }

  // 测试 10: 预估时间计算
  console.log('\n测试 10: 预估时间计算');
  if (lrPlan.totalEstimatedDuration > 0) {
    console.log(`✅ 通过：预估总时间 ${lrPlan.totalEstimatedDuration}秒`);
    passed++;
  } else {
    console.log(`❌ 失败：预估时间错误`);
    failed++;
  }

  console.log(`\n========== TaskPlanner 测试结果 ==========`);
  console.log(`通过：${passed}, 失败：${failed}, 总计：${passed + failed}`);
  
  return { passed, failed, total: passed + failed };
}

// ============== QualityChecker 测试 ==============

async function testQualityChecker() {
  console.log('\n========== QualityChecker 测试 ==========\n');
  
  const checker = new QualityChecker();
  let passed = 0;
  let failed = 0;

  // 测试 1: 完整文献综述质量检查
  console.log('测试 1: 完整文献综述质量检查');
  const goodLiteratureReview = `
## Literature Review: Quantum Computing in Cryptography

### Introduction
Quantum computing poses significant threats to classical cryptographic systems [1].
This review examines the current state of quantum-resistant cryptography.

### Key Findings
1. Shor's algorithm can break RSA encryption [2]
2. Post-quantum cryptography is under development [3]
3. NIST has standardized several PQC algorithms [4]

### Methodology
We analyzed 50+ papers from arxiv.org and ieee.org databases.

### Conclusion
In summary, quantum computing requires new cryptographic approaches.
Future work should focus on implementation efficiency.

## References
[1] Shor, P. (1994). Algorithms for quantum computation.
[2] NIST PQC Standardization Process. https://csrc.nist.gov/
[3] arXiv:2023.12345. Quantum-resistant algorithms.
`;

  const lrReport = await checker.checkQuality('task_001', goodLiteratureReview, {
    stepId: 'step_4',
    taskType: 'literature_review',
    inputQuery: 'quantum computing cryptography',
  });

  if (lrReport.overallScore >= 4.0 && lrReport.passed) {
    console.log(`✅ 通过：综合得分 ${lrReport.overallScore.toFixed(2)}/5`);
    passed++;
  } else {
    console.log(`❌ 失败：得分 ${lrReport.overallScore.toFixed(2)}/5，未通过`);
    failed++;
  }

  // 测试 2: 各维度分数检查
  console.log('\n测试 2: 各维度分数检查');
  const dimensionScores = lrReport.dimensions.map(d => `${d.name}: ${d.score.toFixed(2)}`);
  console.log(`维度分数：${dimensionScores.join(', ')}`);
  
  const allDimensionsValid = lrReport.dimensions.every((d: QualityDimension) => d.score >= 0 && d.score <= 5);
  if (allDimensionsValid) {
    console.log('✅ 通过：所有维度分数在有效范围内');
    passed++;
  } else {
    console.log('❌ 失败：存在无效维度分数');
    failed++;
  }

  // 测试 3: 低质量内容检测
  console.log('\n测试 3: 低质量内容检测');
  const poorContent = `
I think quantum stuff is maybe interesting.
Not sure what to say here.
`;

  const poorReport = await checker.checkQuality('task_002', poorContent, {
    taskType: 'literature_review',
  });

  if (poorReport.overallScore < 3.0 || !poorReport.passed) {
    console.log(`✅ 通过：正确识别低质量内容，得分 ${poorReport.overallScore.toFixed(2)}/5`);
    passed++;
  } else {
    console.log(`❌ 失败：未正确识别低质量内容`);
    failed++;
  }

  // 测试 4: 完整性检查
  console.log('\n测试 4: 完整性检查');
  const completenessDim = lrReport.dimensions.find((d: QualityDimension) => d.name === 'completeness');
  if (completenessDim && completenessDim.score >= 4.0) {
    console.log(`✅ 通过：完整性得分 ${completenessDim.score.toFixed(2)}/5`);
    passed++;
  } else {
    console.log(`❌ 失败：完整性得分不足`);
    failed++;
  }

  // 测试 5: 准确性检查
  console.log('\n测试 5: 准确性检查');
  const accuracyDim = lrReport.dimensions.find((d: QualityDimension) => d.name === 'accuracy');
  if (accuracyDim && accuracyDim.score >= 4.0) {
    console.log(`✅ 通过：准确性得分 ${accuracyDim.score.toFixed(2)}/5`);
    passed++;
  } else {
    console.log(`❌ 失败：准确性得分不足`);
    failed++;
  }

  // 测试 6: 相关性检查
  console.log('\n测试 6: 相关性检查');
  const relevanceDim = lrReport.dimensions.find((d: QualityDimension) => d.name === 'relevance');
  if (relevanceDim && relevanceDim.score >= 4.0) {
    console.log(`✅ 通过：相关性得分 ${relevanceDim.score.toFixed(2)}/5`);
    passed++;
  } else {
    console.log(`❌ 失败：相关性得分不足`);
    failed++;
  }

  // 测试 7: 格式检查
  console.log('\n测试 7: 格式检查');
  const formatDim = lrReport.dimensions.find((d: QualityDimension) => d.name === 'format');
  if (formatDim && formatDim.score >= 4.0) {
    console.log(`✅ 通过：格式得分 ${formatDim.score.toFixed(2)}/5`);
    passed++;
  } else {
    console.log(`❌ 失败：格式得分不足`);
    failed++;
  }

  // 测试 8: 引用质量检查
  console.log('\n测试 8: 引用质量检查');
  const citationDim = lrReport.dimensions.find((d: QualityDimension) => d.name === 'citationQuality');
  if (citationDim && citationDim.score >= 3.5) {
    console.log(`✅ 通过：引用质量得分 ${citationDim.score.toFixed(2)}/5`);
    passed++;
  } else {
    console.log(`❌ 失败：引用质量得分不足`);
    failed++;
  }

  // 测试 9: 严重错误检测
  console.log('\n测试 9: 严重错误检测');
  const contentWithErrors = `
The success rate is 150% which is impossible.
I think maybe probably the data shows 200% improvement.
`;

  const errorReport = await checker.checkQuality('task_003', contentWithErrors);
  if (errorReport.criticalErrors.length > 0 || errorReport.overallScore < 3.0) {
    console.log(`✅ 通过：检测到 ${errorReport.criticalErrors.length} 个严重错误`);
    passed++;
  } else {
    console.log(`❌ 失败：未检测到严重错误`);
    failed++;
  }

  // 测试 10: 建议生成
  console.log('\n测试 10: 建议生成');
  const recommendations = poorReport.recommendations;
  if (recommendations.length > 0) {
    console.log(`✅ 通过：生成了 ${recommendations.length} 条改进建议`);
    console.log(`   建议：${recommendations.slice(0, 2).join('; ')}`);
    passed++;
  } else {
    console.log(`❌ 失败：未生成改进建议`);
    failed++;
  }

  console.log(`\n========== QualityChecker 测试结果 ==========`);
  console.log(`通过：${passed}, 失败：${failed}, 总计：${passed + failed}`);
  
  return { passed, failed, total: passed + failed };
}

// ============== 集成测试 ==============

async function testIntegration() {
  console.log('\n========== 集成测试 ==========\n');
  
  const planner = new TaskPlanner();
  const checker = new QualityChecker();
  let passed = 0;
  let failed = 0;

  // 测试场景：完整的文献综述工作流
  console.log('测试场景：完整的文献综述工作流');
  
  // 步骤 1: 任务分类
  const query = 'Machine learning applications in drug discovery';
  const classification = planner.classifyTask(query);
  console.log(`1. 任务分类：${classification.type} (置信度：${classification.confidence.toFixed(2)})`);
  
  if (classification.type === 'literature_review') {
    console.log('✅ 正确分类为文献综述');
    passed++;
  } else {
    console.log('❌ 分类错误');
    failed++;
  }

  // 步骤 2: 生成计划
  const plan = planner.generatePlan('integration_001', query);
  console.log(`\n2. 生成计划：${plan.steps.length} 个步骤，预估 ${plan.totalEstimatedDuration}秒`);
  
  if (plan.steps.length >= 3) {
    console.log('✅ 计划生成成功');
    passed++;
  } else {
    console.log('❌ 计划步骤不足');
    failed++;
  }

  // 步骤 3: 验证计划
  const validation = planner.validatePlan(plan);
  console.log(`\n3. 计划验证：${validation.valid ? '有效' : '无效'}`);
  
  if (validation.valid) {
    console.log('✅ 计划依赖关系有效');
    passed++;
  } else {
    console.log(`❌ 计划验证失败：${validation.errors.join(', ')}`);
    failed++;
  }

  // 步骤 4: 模拟执行并检查质量
  const simulatedOutput = `
## Literature Review: Machine Learning in Drug Discovery

### Introduction
Machine learning (ML) has revolutionized drug discovery processes [1].
This review covers ML applications from target identification to clinical trials.

### Target Identification
ML models can predict drug-target interactions with high accuracy [2].
Deep learning approaches have shown 85%+ accuracy in recent studies [3].

### Lead Optimization
Generative models design novel molecular structures [4].
Reinforcement learning optimizes molecular properties [5].

### Clinical Trials
ML predicts patient responses and trial outcomes [6].
Sources: nature.com, arxiv.org, pubmed.gov

### Conclusion
In summary, ML accelerates drug discovery across all stages.
Future work should focus on interpretability and regulatory acceptance.

## References
[1] Smith et al. (2023). ML in Pharma. Nature.
[2] DOI: 10.1038/s41586-023-01234
[3] https://arxiv.org/abs/2023.12345
[4] Johnson et al. (2024). Generative Chemistry.
[5] https://pubmed.gov/12345678
[6] Clinical AI Review (2024).
`;

  const qualityReport = await checker.checkQuality('integration_001', simulatedOutput, {
    stepId: 'step_4',
    taskType: 'literature_review',
    inputQuery: query,
  });

  console.log(`\n4. 质量检查：综合得分 ${qualityReport.overallScore.toFixed(2)}/5`);
  console.log(`   通过状态：${qualityReport.passed ? '✅ 通过' : '❌ 未通过'}`);
  
  if (qualityReport.passed && qualityReport.overallScore >= 4.0) {
    console.log('✅ 输出质量达标');
    passed++;
  } else {
    console.log(`❌ 质量未达标：${qualityReport.recommendations.slice(0, 2).join('; ')}`);
    failed++;
  }

  // 步骤 5: 检查各维度
  console.log('\n5. 各维度得分:');
  for (const dim of qualityReport.dimensions) {
    const status = dim.score >= 4.0 ? '✅' : '⚠️';
    console.log(`   ${status} ${dim.name}: ${dim.score.toFixed(2)}/5`);
  }

  const allDimensionsPass = qualityReport.dimensions.every((d: QualityDimension) => d.score >= 3.5);
  if (allDimensionsPass) {
    console.log('✅ 所有维度达到最低标准');
    passed++;
  } else {
    console.log('❌ 部分维度未达标');
    failed++;
  }

  console.log(`\n========== 集成测试结果 ==========`);
  console.log(`通过：${passed}, 失败：${failed}, 总计：${passed + failed}`);
  
  return { passed, failed, total: passed + failed };
}

// ============== 运行所有测试 ==============

async function runAllTests() {
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║  TaskPlanner & QualityChecker 测试套件          ║');
  console.log('║  测试时间：2026-03-07 20:00-21:00              ║');
  console.log('╚════════════════════════════════════════════════╝');

  const taskPlannerResults = testTaskPlanner();
  const qualityCheckerResults = await testQualityChecker();
  const integrationResults = await testIntegration();

  const totalPassed = taskPlannerResults.passed + qualityCheckerResults.passed + integrationResults.passed;
  const totalFailed = taskPlannerResults.failed + qualityCheckerResults.failed + integrationResults.failed;
  const totalTests = totalPassed + totalFailed;

  console.log('\n╔════════════════════════════════════════════════╗');
  console.log('║  测试总结果                                     ║');
  console.log('╚════════════════════════════════════════════════╝');
  console.log(`TaskPlanner:     ${taskPlannerResults.passed}/${taskPlannerResults.total} 通过`);
  console.log(`QualityChecker:  ${qualityCheckerResults.passed}/${qualityCheckerResults.total} 通过`);
  console.log(`集成测试：       ${integrationResults.passed}/${integrationResults.total} 通过`);
  console.log('────────────────────────────────────────────────');
  console.log(`总计：${totalPassed}/${totalTests} 通过 (${((totalPassed/totalTests)*100).toFixed(1)}%)`);

  if (totalFailed === 0) {
    console.log('\n🎉 所有测试通过！Phase 2 测试完成！');
  } else {
    console.log(`\n⚠️  ${totalFailed} 个测试失败，需要修复`);
  }

  return {
    taskPlanner: taskPlannerResults,
    qualityChecker: qualityCheckerResults,
    integration: integrationResults,
    summary: { totalPassed, totalFailed, totalTests },
  };
}

// 运行测试
runAllTests().then(results => {
  console.log('\n测试报告已生成。');
  console.log(`最终结果：${results.summary.totalPassed}/${results.summary.totalTests} 通过`);
}).catch(error => {
  console.error('测试执行失败:', error);
});
